import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import prism from "prism-media";
import { Readable } from "stream";
import { spawn } from "child_process";
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

async function convert_audio(opusStream: prism.opus.Decoder): Promise<Buffer> {
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
            console.log('WAV conversion completed.');
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

//TODO: Fix this mess, loads model every time and has to write and then read from disk -> very inefficient
// Better to use a library Speechmatics or similar
async function transcribe_audio(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const filename = 'temp.txt';
        const whisper = spawn(whisperexe, ['-m', whispermodel, '-f', '-', '-of', 'temp', '-otxt','-nt']);

        whisper.on('error', (error) => {
            console.error('Transcription Error:', error);
            reject(error);
        });
        whisper.on('close', (code) => {
            if (code !== 0) {
                const error = new Error(`Whisper.cpp exited with code ${code}`);
                console.error(error);
                reject(error);
            }
            const transcript = fs.readFileSync(filename, 'utf-8');
            resolve(transcript.trim());
        });

        whisper.stdin.write(buffer);
        whisper.stdin.end();
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

                convert_audio(pcmStream)
                .then(async (wavBuffer) => {                  
                    if (wavBuffer.length < 200000) { // less than 1 second
                        console.log('Skipped short utterance.')
                        return;
                    }

                    const transcription = await transcribe_audio(wavBuffer);
                    const answer = await sendMessage(userId, user.username, transcription);
                    const audioBuffer = await generateTTS(answer);
                    const audioStream = Readable.from(audioBuffer);
                    const resource = createAudioResource(audioStream);
                    player.play(resource);
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