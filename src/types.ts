type Visibility = "public" | "private" | "secret"
type ChatInterface = "text" | "voice"

type ChatMessage = {
    user_id: string
    content: string
    session_uuid: string
}

type ChatSession = {
    id: string,
    session_uuid: string
}

type SessionStorage = {
    users: ChatSession[],
    channels: ChatSession[]
}