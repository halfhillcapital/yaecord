import prism from "prism-media";
import type { VoiceBasedChannel } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, EndBehaviorType, createAudioResource, StreamType, VoiceConnection } from "@discordjs/voice";

import { ChatBuffer } from "../utils/buffer.ts";
import { yaeVoiceMessage } from "./endpoint.ts";
import { AddressingDetector } from "./logic.ts";
import { AudioQueue, opusToWAV } from "./audio.ts";
import { whisperTranscribe, kokoroTTS } from "./integrations.ts";

export async function startVoiceChat(channel: VoiceBasedChannel): Promise<VoiceConnection> {
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
    const messageBuffer = new ChatBuffer();
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

                let context: ChatHistory = []
                const transcription = await whisperTranscribe(wavBuffer);

                if (isGroupChat) {
                    if (addressingDetector.detect(transcription)) {
                        context = messageBuffer.getLastNMessages(5);
                    } else {
                        messageBuffer.addMessage({ user_id: userId, content: transcription });
                        return;
                    }
                }

                // OPUS output is currently bugged in Kokoro TTS, wait for fix
                for await (const sentence of yaeVoiceMessage({ user_id: userId, content: transcription }, context)) {
                    const audioStream = await kokoroTTS(sentence);
                    audioQueue.add(createAudioResource(audioStream, { inputType: StreamType.OggOpus }));
                }
            })
            .catch(err => {
                console.error('Audio Error:', err);
            });
    });

    return connection;
}