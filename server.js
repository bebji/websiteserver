const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080, maxPayload: 10 * 1024 * 1024 });
const chatHistory = [];
const MAX_HISTORY = 100;
const admins = ["ben"]

wss.on('connection', (ws) => {
    ws.username = null;

    if (chatHistory.length > 0) {
        ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
    }

    ws.on('message', (data) => {
        const message = data.toString();

        try {
            const parsed = JSON.parse(message);
            if (parsed.type === 'join') {
                ws.username = parsed.user;
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'message', text: `${parsed.user} connected` }));
                    }
                });
                if(admins.includes(parsed.user)){wss.parsed.user.send(JSON.stringify({ type: 'admin'})) }
                return;
            }
        } catch(e) {}

        if (message.includes(': ')) {
            ws.username = message.split(': ')[0];
        }

        chatHistory.push(message);
        if (chatHistory.length > MAX_HISTORY) {
            chatHistory.shift();
        }

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'message', text: message }));
                console.log(JSON.stringify({ type: 'message', text: message }));
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
