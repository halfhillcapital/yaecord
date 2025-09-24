import prism from "prism-media";
import { Readable } from "stream";
import { spawn } from "child_process";
import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, EndBehaviorType, createAudioResource, AudioPlayerStatus, AudioResource, AudioPlayer } from "@discordjs/voice";

import { yaeCallMessage, yaeChatMessage } from "../agent/endpoint.ts";
import { whisperTranscribe, kokoroTTS } from "../agent/integrations.ts";

const activeStreams = new Map();

async function addSpeechToQueue(queue: AudioResource[], player: AudioPlayer, speech: AudioResource) {
    queue.push(speech);
    if (player.state.status === AudioPlayerStatus.Idle) {
        speak(queue, player);
    }
}

async function speak(queue: AudioResource[], player: AudioPlayer) {
    if (queue.length === 0) return;

    const speech = queue.shift();
    player.play(speech);

    player.once(AudioPlayerStatus.Idle, () => {
        speak(queue, player);
    });
}

async function convertToWAV(opusStream: prism.opus.Decoder): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const sampleRate = 48000;
        const channels = 2;
        const bitDepth = 's16le';

        const ffmpeg = spawn('ffmpeg', [
            '-f', bitDepth,
            '-ar', sampleRate.toString(),
            '-ac', channels.toString(),
            '-i', 'pipe:0',
            '-f', 'wav',
            'pipe:1'
        ]);

        opusStream.pipe(ffmpeg.stdin);
        const wavBuffer: Buffer[] = [];

        ffmpeg.stdout.on('data', (chunk) => {
            wavBuffer.push(chunk);
        });
        ffmpeg.stdout.on('end', () => {
            return resolve(Buffer.concat(wavBuffer));
        });

        ffmpeg.on('error', (error) => {
            console.error('FFMPEG Error:', error);
            return reject(error);
        });
        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                const error = new Error(`FFMPEG exited with code ${code}`);
                console.error(error);
                return reject(error);
            }
        });
    });
}

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

            const player = createAudioPlayer();
            connection.subscribe(player);

            const audioQueue: AudioResource[] = [];

            player.on('error', (error) => {
                console.error('Error occurred:', error);
            });

            await interaction.reply({ content: `Joined ${channel}`, flags: MessageFlags.Ephemeral });

            // Start listening
            connection.receiver.speaking.on('start', (userId) => {
                const user = interaction.client.users.cache.get(userId);

                if (activeStreams.has(userId)) return;
                console.log(`Listening to ${user.username}`);

                const audioStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 500,
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
                        console.log('Skipped short utterance.')
                        return;
                    }

                    const transcription = await whisperTranscribe(wavBuffer);
                    console.log(`${user.username} asked: ${transcription}`);
                    for await (const sentence of yaeCallMessage(userId, transcription)) {
                        const audioBuffer = await kokoroTTS(sentence);
                        addSpeechToQueue(audioQueue, player, createAudioResource(Readable.from(audioBuffer)));
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