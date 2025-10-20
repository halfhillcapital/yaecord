import fetch from "node-fetch";
import FormData from 'form-data';
import { Readable } from "stream";

import { config } from '../config.ts';

export async function whisperTranscribe(audio: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = `${config.WHISPER_URL}/inference`;
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

//af_heart | Good for general use
//af_nicole | Whispery Speech
export async function kokoroTTS(text: string) {
    const body = {
        model: 'kokoro',
        input: text,
        voice: 'af_heart',
        response_format: 'pcm',
        speed: 1.0,
        stream: true
    };
    const response = await fetch(`${config.KOKORO_URL}/v1/audio/speech`, {
        method: "POST",
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    return Readable.from(response.body);
}
