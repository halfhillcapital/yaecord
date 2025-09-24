import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
    data: new SlashCommandBuilder()
        .setName('deafen')
        .setDescription('Deafen or undeafen Yae in the voice channel.')
        .addBooleanOption(option =>
            option.setName('state')
                .setDescription('Whether to deafen (true) or undeafen (false)')
                .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        if (interaction.member.user.id != process.env.ADMIN_ID) {
            await interaction.reply({ content: 'Amusing that you think that would work.', flags: MessageFlags.Ephemeral });
            return;
        }

        const connection = getVoiceConnection(interaction.guild.id);
        const deafenState = interaction.options.getBoolean('state', true);

        if (connection) {
            try {
                await interaction.guild.members.me.voice.setDeaf(deafenState);
                await interaction.reply({ 
                    content: `${deafenState ? 'Deafened' : 'Undeafened'} in voice channel.`, 
                    flags: MessageFlags.Ephemeral 
                });
            } catch (error) {
                console.error('Error modifying deaf state:', error);
                await interaction.reply({ 
                    content: `Failed to ${deafenState ? 'deafen' : 'undeafen'}. Please try again.`, 
                    flags: MessageFlags.Ephemeral 
                });
            }
        } else {
            await interaction.reply({ 
                content: 'Not connected to any voice channel.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
};