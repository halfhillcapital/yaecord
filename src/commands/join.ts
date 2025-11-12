import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

import { startVoiceChat } from "../agent/voice.ts";
import { getSessionManager } from "../agent/sessions.ts";
import { get } from "http";

export default {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make Yae join your voice channel.'),
    async execute(interaction: ChatInputCommandInteraction) {
        if (getVoiceConnection(interaction.guild.id)) {
            await interaction.reply({ content: 'I am already connected to a voice channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (interaction.member.user.id != process.env.ADMIN_ID) {
            await interaction.reply({ content: 'Absolutely not. Find someone else to bother.', flags: MessageFlags.Ephemeral });
            return;
        }

        const member = interaction.member as GuildMember;
        const channel = member.voice.channel;

        if (channel) {
            const sessionManager = await getSessionManager()
            const uuid = await sessionManager.getChannelSession(channel.id)
            const connection = await startVoiceChat(channel, uuid);
            await interaction.reply({ content: `Joined ${channel.name} and ready to chat!`, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: 'You must be in a voice channel for me to join you.', flags: MessageFlags.Ephemeral });
        }
    }
};