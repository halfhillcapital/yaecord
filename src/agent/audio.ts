import prism from "prism-media";
import { spawn } from "child_process";
import { AudioPlayerStatus, AudioResource, AudioPlayer } from "@discordjs/voice";

export class AudioQueue {
    private queue: AudioResource[] = [];
    private player: AudioPlayer;
    public isPlaying: boolean = false;

    constructor(player: AudioPlayer) {
        this.player = player;
    }

    add(resource: AudioResource) {
        this.queue.push(resource);

        if (this.player.state.status === AudioPlayerStatus.Idle) {
            this.play();
        }
    }

    play() {
        if (this.queue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const resource = this.queue.shift();
        this.player.play(resource);

        this.player.once(AudioPlayerStatus.Idle, () => {
            this.play();
        });
    }

    clear() {
        this.isPlaying = false;
        this.queue.length = 0;
        this.player.stop();
    }
}

export async function convertToWAV(opusStream: prism.opus.Decoder): Promise<Buffer> {
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