import prism from "prism-media";

import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, EndBehaviorType, createAudioResource, AudioReceiveStream, StreamType } from "@discordjs/voice";

import { yaeVoiceMessage } from "../agent/endpoint.ts";
import { AudioQueue, convertToWAV } from "../agent/audio.ts";
import { AddressingDetector } from "../agent/logic.ts";
import { ChatBuffer } from "../utils/buffer.ts";
import { whisperTranscribe, kokoroTTS } from "../agent/integrations.ts";

export default {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make Yae join your voice channel.'),
    async execute(interaction: ChatInputCommandInteraction) {
        if (getVoiceConnection(interaction.guild.id)) {
            await interaction.reply({ content: 'I am already connected to a voice channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (interaction.member.user.id != process.env.ADMIN_ID) {
            await interaction.reply({ content: 'Absolutely not. Find someone else to bother.', flags: MessageFlags.Ephemeral });
            return;
        }

        const member = interaction.member as GuildMember;
        const channel = member.voice.channel;
        if (channel) {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            let groupChat: boolean = false;
            const messageBuffer = new ChatBuffer();
            const addressingDetector = new AddressingDetector();
            const activeStreams: Map<string, AudioReceiveStream> = new Map();
            
            const player = createAudioPlayer();
            player.on('error', (error) => {
                console.error('Error occurred:', error);
            });

            connection.subscribe(player);
            const audioQueue = new AudioQueue(player);

            await interaction.reply({ content: `Joined ${channel}`, flags: MessageFlags.Ephemeral });

            // Start listening
            connection.receiver.speaking.on('start', (userId) => {
                const user = interaction.client.users.cache.get(userId);

                if (activeStreams.has(userId)) return;

                if (channel.members.size > 2) groupChat = true;
                else groupChat = false;

                const audioStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 250,
                    },
                });

                activeStreams.set(userId, audioStream);

                const pcmStream = audioStream.pipe(
                    new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 })
                );

                pcmStream.on('end', () => {
                    activeStreams.delete(userId);
                });
                
                convertToWAV(pcmStream)
                .then(async (wavBuffer) => {               
                    if (wavBuffer.length < 200000) { // less than 1 second
                        return;
                    }

                    // if (audioQueue.isPlaying) {
                    //     audioQueue.clear();
                    // }

                    let context: ChatHistory = []
                    const transcription = await whisperTranscribe(wavBuffer);
                    console.log(`${user.username}: ${transcription}`);
                    if (groupChat) {
                        if (addressingDetector.detect(transcription)) {
                            context = messageBuffer.getLastNMessages(5);
                        } else {
                            messageBuffer.addMessage({ user_id: userId, content: transcription });
                            return;
                        }
                    }

                    for await (const sentence of yaeVoiceMessage({ user_id: userId, content: transcription }, context)) {
                        console.log(`Yae: ${sentence}`);
                        const audioStream = await kokoroTTS(sentence);
                        audioQueue.add(createAudioResource(audioStream, { inputType: StreamType.Arbitrary }));
                    }
                })
                .catch(err => {
                    console.error('Audio Error:', err);
                });
            });
        } else {
            await interaction.reply({ content: 'You must be in a voice channel for me to join you.', flags: MessageFlags.Ephemeral });
        }
    }
};