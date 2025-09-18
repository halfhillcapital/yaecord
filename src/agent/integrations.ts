import fetch from "node-fetch";
import FormData from 'form-data';
import { Readable } from "stream";

export async function whisperTranscribe(audio: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = 'http://localhost:8080/inference';
        const form = new FormData();
        form.append('file', Readable.from(audio));
        form.append('temperature', '0.0');
        form.append('temperature_inc', '0.2');
        form.append('response_format', 'text');

        fetch(url, {
            method: 'POST',
            headers: form.getHeaders(),
            body: form
        })
        .then(res => res.text())
        .then(text => resolve(text.trim()))
        .catch(err => reject(err));
    });
}

export async function cartesiaTTS(text: string) {
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