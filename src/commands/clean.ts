import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, Message, Collection } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName('clean')
        .setDescription('Deletes all messages in this text channel.'),
    async execute(interaction: ChatInputCommandInteraction) {
        let fetched: Collection<string, Message>;
        do {
            fetched = await interaction.channel.messages.fetch({ limit: 100 });
            await interaction.channel.bulkDelete(fetched);
        } while (fetched.size >= 2);
        await interaction.reply({ content: 'Cleaned up this channel!', flags: MessageFlags.Ephemeral });
    }
};