import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import prism from "prism-media";
import { Readable } from "stream";
import { exec } from "child_process";
import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, EndBehaviorType, createAudioResource, AudioPlayerStatus } from "@discordjs/voice";

const activeStreams = new Map();
const whisperexe = path.join(process.cwd(), 'whispercpp', 'whisper-cli.exe');
const whispermodel = path.join(process.cwd(), 'whispercpp', 'models', 'ggml-medium.bin');

async function sendMessage(user_id: string, username: string, message: string) {
    console.log(`Sending ${user_id} : ${username} = ${message}`);
    const response = await fetch(process.env.YAE_URL + '/chat', {
        method: "POST",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            user_id: user_id,
            username: username,
            message: message,
        }),
    });
    try {
        const data = await response.json();
        console.log("Yae Answers:", data);
        return data;
    } catch (error) { console.error(error); }
}

async function generateTTS(text: string) {
    const body = {
        model_id: 'sonic-2',
        transcript: text,
        voice: { mode: 'id', id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02'},
        output_format: {
            container: 'mp3',
            sample_rate: 48000,
            bit_rate: 128000
        },
        language: 'en',
        speed: 'normal'
    };
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
        method: "POST",
        headers: {
            'Cartesia-Version': '2024-06-10',
            'content-type': 'application/json',
            'X-API-Key': process.env.CARTESIA_API_KEY
        },
        body: JSON.stringify(body)
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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

            player.on(AudioPlayerStatus.Playing, () => {
                console.log('The audio player has started playing!');
            });

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
                        duration: 1000,
                    },
                });

                activeStreams.set(userId, audioStream);

                const pcmStream = audioStream.pipe(
                    new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 })
                );

                pcmStream.on('end', () => {
                    console.log(`Stream from ${user.username} ended.`)
                    activeStreams.delete(userId);
                });

                const filename = `./recordings/${user.username}-${Date.now()}.pcm`;
                const writeStream = fs.createWriteStream(filename);
                pcmStream.pipe(writeStream);

                writeStream.on('finish', async () => {
                    console.log(`Saved ${filename}`);

                    const stats = fs.statSync(filename);
                    const bytesPerSecond = 48000 * 2 * 2;
                    const durationSec = stats.size / bytesPerSecond;

                    if (durationSec < 1.0) {
                        console.log('Skipped short utterance.')
                        fs.unlink(filename, (err) => { if (err) console.log(err); });
                        return;
                    }

                    const wavFile = filename.replace('.pcm', '.wav');
                    //TODO: Rewrite using promises
                    exec(
                        `ffmpeg -f s16le -ar 48k -ac 2 -i ${filename} ${wavFile}`,
                        async (err) => {
                            if (err) {
                                console.error('FFMPEG Error:', err);
                                return;
                            }

                            exec(
                                `${whisperexe} -m ${whispermodel} -f ${wavFile} -nt`,
                                async (err, stdout) => {
                                    if (err) {
                                        console.error('STT Error:', err);
                                        return;
                                    }
                                    const answer = await sendMessage(userId, user.username, stdout.trim());
                                    const audioBuffer = await generateTTS(answer);
                                    const audioStream = Readable.from(audioBuffer);
                                    const resource = createAudioResource(audioStream);
                                    player.play(resource);
                                }
                            );

                            fs.unlink(filename, (err) => { if (err) console.log(err); });
                        }
                    );
                });
            });
        } else {
            await interaction.reply({ content: 'You must be in a voice channel for me to join you.', flags: MessageFlags.Ephemeral });
        }
    }
};