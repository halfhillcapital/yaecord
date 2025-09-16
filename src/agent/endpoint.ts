//TODO: filter out @mentions from message before sending to YAE

export async function sendMessage(user_id: string, username: string, message: string) {
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
        return data;
    } catch (error) { console.error(error); }
}