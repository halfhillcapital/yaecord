import { createClient, DeepgramClient, ListenLiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { CartesiaClient } from "@cartesia/cartesia-js";
import type { VoiceBasedChannel } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, EndBehaviorType, createAudioResource, StreamType, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";

import { AudioQueue } from "./audio.ts";
import { createMessage, sentencesFromStream } from "./endpoint.ts";
import { cartesiaTTS } from "./integrations.ts";

// Issues
// The first time a user speaks after Yae joins, it only sets up Deepgram but does not transcribe

class AddressingDetector {
    private addressingKeywords: string[];

    constructor(keywords?: string[]) {
        this.addressingKeywords = keywords || ['yae', 'kitsune'];
    }

    public detect(message: string): boolean {
        const lowerCaseMessage = message.toLowerCase();
        return this.addressingKeywords.some(keyword => lowerCaseMessage.includes(keyword));
    }
}

class UserConnection {
    userId: string
    isTalking: boolean
    lastSpoken: number

    sttConnection: ListenLiveClient

    constructor(userId: string) {
        this.userId = userId
        this.isTalking = false
        this.lastSpoken = Date.now()
    }

    public setupTranscriptionHandlers(deepgram: DeepgramClient, onTranscript: (data: any) => Promise<void>) {
        const connection = deepgram.listen.live({
            model: 'nova-3',
            language: 'de',
            encoding: 'opus',
            sample_rate: 48000,
            channels: 2,
            smart_format: true,
            keyterm: ['Yae', 'kitsune']
        })

        connection.on(LiveTranscriptionEvents.Open, () => {
            console.log(`Deepgram connection for ${this.userId} opened`)

            const keepAlive = setInterval(() => {
                connection.keepAlive()
            }, 3000)

            connection.on(LiveTranscriptionEvents.Close, () => {
                console.log(`Deepgram connection for ${this.userId} closed`)
                if (keepAlive) clearInterval(keepAlive)
            })

            connection.on(LiveTranscriptionEvents.Error, (err) => {
                console.error(err)
            })

            connection.on(LiveTranscriptionEvents.Transcript, async (data) => {
                await onTranscript(data)
            })
        })
        this.sttConnection = connection;
    }
}

export async function startVoiceChat(channel: VoiceBasedChannel, session: string): Promise<VoiceConnection> {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
    })

    const player = createAudioPlayer();
    player.on('error', (error) => {
        console.error('Player Error:', error)
    })
    connection.subscribe(player)

    let isGroupChat: boolean = false
    const audioQueue = new AudioQueue(player)
    const addressingDetector = new AddressingDetector()
    const activeStreams: Map<string, UserConnection> = new Map()

    const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY)
    const cartesiaClient = new CartesiaClient({ apiKey: process.env.CARTESIA_API_KEY });

    // Start listening
    connection.receiver.speaking.on('start', (userId) => {
        if (activeStreams.has(userId) && activeStreams.get(userId).isTalking) return;

        if (channel.members.size > 2) isGroupChat = true;
        else isGroupChat = false;

        if (!activeStreams.has(userId)) {
            console.log(`Setting up Deepgram for user ${userId}`);
            const temp = new UserConnection(userId);
            temp.setupTranscriptionHandlers(deepgramClient, async (data) => {
                const transcript = data.channel.alternatives[0].transcript;
                if (!transcript || transcript.trim() === '') return;
                console.log(`${userId}:${transcript}`);

                if (isGroupChat && !addressingDetector.detect(transcript)) {
                    const savedMessage = await createMessage({ user_id: userId, content: transcript, session_uuid: session })
                    console.log("SAVED | ", savedMessage)
                    return
                }

                for await (const sentence of sentencesFromStream({ user_id: userId, content: transcript, session_uuid: session }, "voice")) {
                    const opusStream = await cartesiaTTS(sentence, cartesiaClient);
                    audioQueue.add(createAudioResource(opusStream, { inputType: StreamType.Opus }))
                }
            })
            activeStreams.set(userId, temp)
        }

        const userConn = activeStreams.get(userId)
        userConn.isTalking = true
        userConn.lastSpoken = Date.now()

        const audioStream = connection.receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 1000,
            },
        });

        audioStream.on('data', (chunk) => {
            userConn.sttConnection.send(chunk)
        })

        audioStream.on('end', () => {
            userConn.isTalking = false
        })

        audioStream.on('error', (err) => {
            console.error(`Audio Stream Error ${userId}:`, err)
        })
    });

    // Clean up on disconnect
    connection.on('stateChange', (oldState, newState) => {
        if (newState.status === VoiceConnectionStatus.Destroyed) {
            console.log('Voice connection disconnected, cleaning up Deepgram connections');
            for (const userConn of activeStreams.values()) {
                if (userConn.sttConnection) {
                    userConn.sttConnection.disconnect();
                }
            }
        }
    });

    return connection;
}