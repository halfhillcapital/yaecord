import { JSONFilePreset } from "lowdb/node"
import { createSession } from "./endpoint.ts"


const defaultData: SessionStorage = { users: [], channels: [] }

class SessionManager {
    private static instance: SessionManager
    private db: any

    private constructor() {
        this.db = null
    }

    static async getInstance(): Promise<SessionManager> {
        if(!SessionManager.instance) {
            SessionManager.instance = new SessionManager()
            await SessionManager.instance.init()
        }
        return SessionManager.instance
    }

    private async init(): Promise<void> {
        if (!this.db) {
            this.db = await JSONFilePreset<SessionStorage>('db.json', defaultData)
        }
    }

    async createPublicSession(userId: string): Promise<string> {
        const uuid = await createSession(userId, "public")

        return uuid
    }

    async getUserSession(userId: string): Promise<string> {
        await this.db.read()
        const { users } = this.db.data
        let sess = users.find((u) => u.user_id == userId)
    
        if (!sess) {
            const uuid = await createSession(userId, "private")
            sess = {
                user_id: userId,
                session_uuid: uuid
            }
            users.push(sess)
            await this.db.write()
        }
        return sess.session_uuid
    }

    async getChannelSession(channelId: string): Promise<string> {
        await this.db.read()
        const { channels } = this.db.data
        let sess = channels.find((c) => c.user_id == channelId)
    
        if (!sess) {
            const uuid = await createSession(process.env.DISCORD_CLIENT_ID, "public")
            sess = {
                user_id: channelId,
                session_uuid: uuid
            }
            channels.push(sess)
            await this.db.write()
        }
        return sess.session_uuid
    }

    async getAllUsers(): Promise<ChatSession[]> {
        await this.db.read()
        const { users } = this.db.data
        return users
    }

    async getAllChannels(): Promise<ChatSession[]> {
        await this.db.read()
        const { channels } = this.db.data
        return channels
    }
}

export const getSessionManager = () => SessionManager.getInstance()