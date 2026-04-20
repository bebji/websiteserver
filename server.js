const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const wss = new WebSocket.Server({ port: process.env.PORT || 8080, maxPayload: 10 * 1024 * 1024 });
const admins = ["ben"];

wss.on('connection', async (ws) => {
    ws.username = null;

    const { data: history } = await supabase
        .from('messages')
        .select('content')
        .order('created_at', { ascending: true })
        .limit(100);

    if (history && history.length > 0) {
        ws.send(JSON.stringify({ type: 'history', messages: history.map(m => m.content) }));
    }

    ws.on('message', async (data) => {
        const message = data.toString();
        try {
            const parsed = JSON.parse(message);
            if (parsed.type === 'ping') return;
            if (parsed.type === 'join') {
                ws.username = parsed.user;
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'message', text: `${parsed.user} connected` }));
                    }
                });
                if (admins.includes(parsed.user)) {
                    ws.send(JSON.stringify({ type: 'admin' }));
                }
                return;
            }
            if (parsed.type === 'image') {
                // broadcast images but don't save to history
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'message', text: message }));
                    }
                });
                return;
            }
        } catch(e) {}

        if (message.includes(': ')) {
            ws.username = message.split(': ')[0];
        }

        await supabase.from('messages').insert({ content: message });

        // keep only last 100 messages
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true });
        if (count > 100) {
            const { data: oldest } = await supabase
                .from('messages')
                .select('id')
                .order('created_at', { ascending: true })
                .limit(count - 100);
            const ids = oldest.map(m => m.id);
            await supabase.from('messages').delete().in('id', ids);
        }

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'message', text: message }));
            }
        });
    });

    ws.on('close', () => {
        const name = ws.username || 'someone';
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'message', text: `${name} disconnected` }));
            }
        });
    });
});

console.log('Server is running on port 8080');
