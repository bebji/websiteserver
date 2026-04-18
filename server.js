const WebSocket = require('ws');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
const wss = new WebSocket.Server({ port: process.env.PORT || 8080, maxPayload: 10 * 1024 * 1024 });
const admins = ["ben"];
wss.on('connection', async (ws) => {
    ws.username = null;

    const history = await redis.lrange('chatHistory', 0, 99);
    if (history.length > 0) {
        ws.send(JSON.stringify({ type: 'history', messages: history.reverse() }));
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
        } catch(e) {}

        if (message.includes(': ')) {
            ws.username = message.split(': ')[0];
        }

        await redis.lpush('chatHistory', message);
        await redis.ltrim('chatHistory', 0, 99);

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
