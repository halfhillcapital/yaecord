import express from 'express';
import type { Application, Request } from 'express';
import { Client, TextChannel } from 'discord.js';
import { getVoiceConnection } from "@discordjs/voice";

import { config } from './config.ts';
import { startVoiceChat } from './agent/voice.ts';

type MessageRequest = {
    type: 'channel' | 'user';
    id: string;
    message: string;
};

type VoiceRequest = {
    id: string
};

// Export function to start the server with a Discord client instance
export function startAPIServer(discordClient: Client): Application {
    const app = express();

    app.get('/status', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.post('/message', express.json(),
        async (req: Request<{}, {}, MessageRequest>, res) => {
            const { type: targetType, id: targetId, message } = req.body;

            if (targetType === 'channel') {
                const channel = discordClient.channels.cache.get(targetId) as TextChannel;
                if (!channel) {
                    return res.status(404).json({ error: 'Channel not found.' });
                }

                try {
                    await channel.send(message);
                    res.status(200).json({ success: true });
                } catch (error) {
                    console.error('Error sending message:', error);
                    res.status(500).json({ error: 'Failed to send message.' });
                }
            } else if (targetType === 'user') {
                const user = await discordClient.users.fetch(targetId);
                if (!user) {
                    return res.status(404).json({ error: 'User not found.' });
                }

                try {
                    await user.send(message);
                    res.status(200).json({ success: true });
                } catch (error) {
                    console.error('Error sending message:', error);
                    res.status(500).json({ error: 'Failed to send message.' });
                }
            }
        });

    app.post('/voice', express.json(),
        async (req: Request<{}, {}, VoiceRequest>, res) => {
            if (getVoiceConnection(process.env.DISCORD_GUILD_ID)) {
                res.status(500).json({ error: 'I am already connected to a voice channel.' })
                return;
            }

            const guild = await discordClient.guilds.fetch(process.env.DISCORD_GUILD_ID);
            const member = await guild.members.fetch(req.body.id);
            const channel = member.voice.channel;

            if (channel) {
                const connection = startVoiceChat(channel);
                res.status(200).json({ success: true });
            } else res.status(500).json({ error: 'You must be in a voice channel for me to join you.' });
        });

    app.delete('/voice', express.json(),
        async (req, res) => {
            const connection = getVoiceConnection(process.env.DISCORD_GUILD_ID);

            if (connection) {
                connection.destroy();
                res.status(200).json({ success: true });
            }
            else res.status(404).json({ error: 'Not connected to any voice channel.' });
        });

    app.listen(config.PORT, () => {
        console.log(`API server is running on http://localhost:${config.PORT}`);
    });

    return app;
}
