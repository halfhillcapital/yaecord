//TODO: filter out @mentions from message before sending to YAE

import { config } from "../config.ts"

export async function createSession(user_id: string, visibility: Visibility): Promise<string> {
    const response = await fetch(`${config.YAE_URL}/sessions`, {
            method: "POST",
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                identifier: user_id,
                platform: 'discord',
                visibility: visibility
            })
        })
    
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`, { cause: await response.text() });

    const result = await response.json()
    return result.uuid
}

export async function createMessage(msg: ChatMessage): Promise<string> {
    const response = await fetch(`${config.YAE_URL}/sessions/${msg.session_uuid}`, {
            method: "POST",
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message: {
                    identifier: msg.user_id,
                    content: msg.content
                },
                platform: 'discord'
            })
        })
    
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`, { cause: await response.text() });

    const result = await response.json()
    return `${result.name}: ${result.content}`
}

export async function* yaeRequest(msg: ChatMessage, method: ChatInterface = "text"): AsyncGenerator<string> {
    try {
        const response = await fetch(`${config.YAE_URL}/chat`, {
            method: "POST",
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message: {
                    identifier: msg.user_id,
                    content: msg.content
                },
                interface: method,
                platform: 'discord',
                session: msg.session_uuid,
                attachments: []
            }),
        });
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`, { cause: await response.text() });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield decoder.decode(value, { stream: true });
        }

    } catch (error) { 
        console.error(error); 
        return 'Something went wrong. Please try again later.';
    }
}