import fs from "fs";
import path from "path";
import { Client, Events, Collection, GatewayIntentBits, MessageFlags, Partials } from "discord.js";

import { sendMessage } from "./agent/endpoint.ts";

// Extend the Client type to include 'commands'
declare module "discord.js" {
  interface Client {
    commands: Collection<string, any>;
  }
}

import join from "./commands/join.ts"
import leave from "./commands/leave.ts"
import clean from "./commands/clean.ts"

process.loadEnvFile();

const discord = new Client({
    partials: [
        Partials.Channel,
    ],
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

    const userId = message.author.id;
    const username = message.author.username;
    const content = message.content;
    
    // Direct Message
    if (message.guild === null) {
        await message.channel.sendTyping();
        const response = await sendMessage(userId, username, content);
        await message.channel.send(response);
        return;
    }

    // Mentions and Replies
    if (message.mentions.has(discord.user || '') || message.reference) {
        await message.channel.sendTyping();
        const response = await sendMessage(userId, username, content);
        await message.reply(response);
        return;
    }
});

discord.once(Events.ClientReady, () => {
    if (discord.user) {
        console.log(`Logged in as ${discord.user.tag}`);
    } else {
        console.log('Logged in, but user is not available.');
    }

    // Uncomment the following lines to clear all commands (for debugging purposes)
    // const guild = discord.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    // discord.application.commands.set([]);
    // guild?.commands.set([]);
});

discord.login(process.env.DISCORD_API_KEY)