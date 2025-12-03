import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from "discord.js";
import { registerUser } from "../agent/endpoint.ts";

export default {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register an account with the system.')
        .addStringOption(option => option.setName('name').setDescription('Your real name.').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const user = interaction.user;
            const name = interaction.options.getString('name', true);
            const registeredName = await registerUser(name, user.id, user.tag);
            
            await interaction.reply({ 
                content: `Successfully registered as ${registeredName}!`, 
                flags: MessageFlags.Ephemeral 
            });
        } catch (error) {
            console.error('Registration error:', error);
            await interaction.reply({ 
                content: 'Registration failed. Please try again later.', 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
};