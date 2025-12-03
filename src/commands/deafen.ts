import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
    data: new SlashCommandBuilder()
        .setName('deafen')
        .setDescription('Deafen or undeafen Yae in the voice channel.'),
    async execute(interaction: ChatInputCommandInteraction) {
        const connection = getVoiceConnection(interaction.guild.id);

        if (connection) {
            try {
                const currentState = interaction.guild.members.me.voice.deaf;
                const newState = !currentState;
                await interaction.guild.members.me.voice.setDeaf(newState);
                await interaction.reply({ 
                    content: `${newState ? 'Deafened' : 'Undeafened'} in voice channel.`, 
                    flags: MessageFlags.Ephemeral 
                });
            } catch (error) {
                console.error('Error modifying deaf state:', error);
                await interaction.reply({ 
                    content: `Failed to toggle deafen state. Please try again.`, 
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