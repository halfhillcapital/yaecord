import express from 'express';
import type { Application, Request } from 'express';
import { Client, TextChannel, User } from 'discord.js';

type SendMessageRequest = {
    targetType: 'channel' | 'user';
    targetId: string;
    message: string;
};

// Export function to start the server with a Discord client instance
export function startAPIServer(discordClient: Client): Application {
    const app = express();
    const PORT = 8020;

    app.get('/status', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.post('/send-message', express.json(),
        async (req: Request<{}, {}, SendMessageRequest>, res) => {
            const { targetType, targetId, message } = req.body;

            if (targetType === 'channel') {
                const channel = discordClient.channels.cache.get(targetId) as TextChannel;
                if (!channel) {
                    return res.status(404).json({ error: 'Channel not found' });
                }

                try {
                    await channel.send(message);
                    res.json({ success: true });
                } catch (error) {
                    console.error('Error sending message:', error);
                    res.status(500).json({ error: 'Failed to send message' });
                }
            } else if (targetType === 'user') {
                const user = await discordClient.users.fetch(targetId);
                if (!user) {
                    return res.status(404).json({ error: 'User not found' });
                }

                try {
                    await user.send(message);
                    res.json({ success: true });
                } catch (error) {
                    console.error('Error sending message:', error);
                    res.status(500).json({ error: 'Failed to send message' });
                }
            }
        });

    app.listen(PORT, () => {
        console.log(`API server is running on http://localhost:${PORT}`);
    });

    return app;
}
