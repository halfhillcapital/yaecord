import prism from "prism-media";
import type { VoiceBasedChannel } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, EndBehaviorType, createAudioResource, StreamType, VoiceConnection } from "@discordjs/voice";

import { AudioQueue, opusToWAV } from "./audio.ts";
import { createMessage, yaeVoiceMessage } from "./endpoint.ts";
import { whisperTranscribe, kokoroTTS } from "./integrations.ts";


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

export async function startVoiceChat(channel: VoiceBasedChannel, session: string): Promise<VoiceConnection> {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    const player = createAudioPlayer();
    player.on('error', (error) => {
        console.error('Error occurred:', error);
    });
    connection.subscribe(player);

    let isGroupChat: boolean = false;
    const audioQueue = new AudioQueue(player);
    const addressingDetector = new AddressingDetector();
    const activeStreams: Map<string, number> = new Map();

    // Start listening
    connection.receiver.speaking.on('start', (userId) => {
        if (activeStreams.has(userId)) return;

        if (channel.members.size > 2) isGroupChat = true;
        else isGroupChat = false;

        const audioStream = connection.receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 250,
            },
        });

        activeStreams.set(userId, Date.now());

        const pcmStream = audioStream.pipe(
            new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 })
        );

        pcmStream.on('end', () => {
            activeStreams.delete(userId);
        });

        opusToWAV(pcmStream)
            .then(async (wavBuffer) => {
                if (wavBuffer.length < 200000) { // less than 1 second
                    return;
                }

                // if (audioQueue.isPlaying) {
                //     audioQueue.clear();
                // }

                let context: ChatMessage[] = []
                const transcription = await whisperTranscribe(wavBuffer);

                if (isGroupChat && !addressingDetector.detect(transcription)) {
                    const savedMessage = await createMessage({ user_id: userId, content: transcription, session_uuid: session })
                    console.log(savedMessage)
                    return
                }

                // OPUS output is currently bugged in Kokoro TTS, converting PCM to OPUS here in the meantime
                for await (const sentence of yaeVoiceMessage({ user_id: userId, content: transcription, session_uuid: session })) {
                    const pcmStream = await kokoroTTS(sentence);
                    const opusStream = pcmStream.pipe(
                        new prism.opus.Encoder({ rate: 24000, channels: 1, frameSize: 480 })
                    );
                    audioQueue.add(createAudioResource(opusStream, { inputType: StreamType.Opus }));
                }
            })
            .catch(err => {
                console.error('Audio Error:', err);
            });
    });

    return connection;
}