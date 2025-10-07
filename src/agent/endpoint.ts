//TODO: filter out @mentions from message before sending to YAE

export async function yaeChatMessage(msg: ChatMessage): Promise<string> {
    try {
        const response = await fetch(process.env.YAE_URL + '/chat', {
            method: "POST",
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message: msg
            }),
        });
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`, { cause: await response.text() });
        const data = await response.json();
        return data;
    } catch (error) { 
        console.error(error); 
        return 'Something went wrong. Please try again later.';
    }
}

export async function* yaeVoiceMessage(msg: ChatMessage, context?: ChatHistory): AsyncGenerator<string> {
    try {
        const response = await fetch(process.env.YAE_URL + '/voice', {
            method: "POST",
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message: msg,
                ...(context && { context })
            }),
        });
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`, { cause: await response.text() });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sentenceEnd;
            while ((sentenceEnd = buffer.search(/[.!?](?:\s|$)/)) !== -1) {
                // Include the punctuation in the sentence
                const sentence = buffer.slice(0, sentenceEnd + 1).trim();
                if (sentence) yield sentence;
                buffer = buffer.slice(sentenceEnd + 1);
            }
        }
        // Yield any remaining text as a sentence
        if (buffer.trim()) yield buffer.trim();
    } catch (error) {
        console.error(error);
        yield 'Something went wrong. Please try again later.';
    }
}