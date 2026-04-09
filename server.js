const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const chatHistory = [];
const MAX_HISTORY = 100; // how many messages to keep

wss.on('connection', (ws) => {
    console.log('client connected');

    // Send chat history to the newly connected client
    if (chatHistory.length > 0) {
        ws.send(JSON.stringify({ type: 'history', messages: chatHistory }));
    }

    ws.on('message', (data) => {
        const message = data.toString();

        // Save to history
        chatHistory.push(message);
        if (chatHistory.length > MAX_HISTORY) {
            chatHistory.shift(); // drop oldest message
        }

        // Broadcast to all clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'message', text: message }));
            }
        });
    });

    ws.on('close', () => console.log('client disconnected'));
});

console.log('Server is running on port 8080');
