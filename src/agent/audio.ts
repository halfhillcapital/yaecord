import prism from "prism-media";
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

export async function opusToWAV(
    decoder: prism.opus.Decoder,
    channels = 2,
    sampleRate = 48000,
    bitsPerSample = 16
): Promise<Buffer> {
    const chunks: Buffer[] = [];

    // Collect all PCM data from the decoder stream
    await new Promise<void>((resolve, reject) => {
        decoder.on("data", (chunk: Buffer) => chunks.push(chunk));
        decoder.on("end", () => resolve());
        decoder.on("error", (err) => reject(err));
    });

    const pcmData = Buffer.concat(chunks);
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const chunkSize = 36 + dataSize;

    // Create a WAV header buffer (44 bytes)
    const header = Buffer.alloc(44);

    header.write("RIFF", 0);                  // ChunkID
    header.writeUInt32LE(chunkSize, 4);       // ChunkSize
    header.write("WAVE", 8);                  // Format
    header.write("fmt ", 12);                 // Subchunk1ID
    header.writeUInt32LE(16, 16);             // Subchunk1Size (PCM)
    header.writeUInt16LE(1, 20);              // AudioFormat (1 = PCM)
    header.writeUInt16LE(channels, 22);       // NumChannels
    header.writeUInt32LE(sampleRate, 24);     // SampleRate
    header.writeUInt32LE(byteRate, 28);       // ByteRate
    header.writeUInt16LE(blockAlign, 32);     // BlockAlign
    header.writeUInt16LE(bitsPerSample, 34);  // BitsPerSample
    header.write("data", 36);                 // Subchunk2ID
    header.writeUInt32LE(dataSize, 40);       // Subchunk2Size

    // Combine header + PCM data
    return Buffer.concat([header, pcmData]);
}