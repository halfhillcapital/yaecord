import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make Yae leave the voice channel.'),
    async execute(interaction: ChatInputCommandInteraction) {
        const connection = getVoiceConnection(interaction.guild.id);

        if (connection) {
            connection.destroy();
            await interaction.reply({ content: 'Disconnected.', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: 'Not connected to any voice channel.', flags: MessageFlags.Ephemeral });
        }
    }
};