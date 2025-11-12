type Visibility = "public" | "private" | "secret"

type ChatMessage = {
    user_id: string
    content: string
    session_uuid: string
}

type UserSession = {
    user_id: string,
    session_uuid: string
}

type SessionStorage = {
    users: UserSession[],
    channels: UserSession[]
}