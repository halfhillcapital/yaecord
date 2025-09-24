import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make Yae leave the voice channel.'),
    async execute(interaction: ChatInputCommandInteraction) {
        if (interaction.member.user.id != process.env.ADMIN_ID) {
            await interaction.reply({ content: 'Absolutely not. Find someone else to bother.', flags: MessageFlags.Ephemeral });
            return;
        }

        const connection = getVoiceConnection(interaction.guild.id);

        if (connection) {
            connection.destroy();
            await interaction.reply({ content: 'Disconnected.', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: 'Not connected to any voice channel.', flags: MessageFlags.Ephemeral });
        }
    }
};