import fs from "fs";
import path from "path";
import { Client, Events, Collection, GatewayIntentBits, MessageFlags } from "discord.js";

// Extend the Client type to include 'commands'
declare module "discord.js" {
  interface Client {
    commands: Collection<string, any>;
  }
}

import join from "./commands/voice/join.ts"
import leave from "./commands/voice/leave.ts"
import clean from "./commands/clean.ts"

process.loadEnvFile();

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

discord.commands = new Collection();
discord.commands.set(join.data.name, join);
discord.commands.set(leave.data.name, leave);
discord.commands.set(clean.data.name, clean);

// Executing Slash Commands
discord.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    }
});

// Answering Messages
discord.on(Events.MessageCreate, async (message) => {
    if (message.author.id === discord.user?.id) {
        console.log('Ignore message from self...')
        return; 
    }
    if (message.author.bot) {
        console.log('Ignore other bots...')
        return;
    }
    
    // Direct Message
    if (message.guild === null) {

        return;
    }

    // Mentions and Replies
    if (message.mentions.has(discord.user || '') || message.reference) {

        return;
    }
});

discord.once(Events.ClientReady, () => {
    if (discord.user) {
        console.log(`Logged in as ${discord.user.tag}`);
    } else {
        console.log('Logged in, but user is not available.');
    }
});

discord.login(process.env.DISCORD_API_KEY)

//TODO: Edit voice slash commands so that Yae only joins if she is not already in a channel
//TODO: Make it so that only I and the person that invited her can make her disconnect