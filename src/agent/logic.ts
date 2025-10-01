export class AddressingDetector {
    private addressingKeywords: string[];

    constructor(keywords?: string[]) {
        this.addressingKeywords = keywords || ['yae', 'kitsune'];
    }

    public detect(message: string): boolean {
        const lowerCaseMessage = message.toLowerCase();
        return this.addressingKeywords.some(keyword => lowerCaseMessage.includes(keyword));
    }
}
