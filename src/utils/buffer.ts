export class ChatBuffer {
    private buffer: ChatHistory = [];

    addMessage(msg: ChatMessage) {
        this.buffer.push(msg);
    }

    getLastNMessages(n: number): ChatHistory {
        return this.buffer.slice(-n);
    }
}