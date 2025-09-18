//TODO: filter out @mentions from message before sending to YAE

export async function yaeChatMessage(user_id: string, message: string): Promise<string> {
    const response = await fetch(process.env.YAE_URL + '/chat', {
        method: "POST",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            user_id: user_id,
            message: message
        }),
    });
    try {
        const data = await response.json();
        return data;
    } catch (error) { console.error(error); }
}

export async function* yaeCallMessage(user_id: string, message: string) {
    const response = await fetch(process.env.YAE_URL + '/call', {
        method: "POST",
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            user_id: user_id,
            message: message
        }),
    });
    try {
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
    }
}