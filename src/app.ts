import { 
    Client, 
    Events, 
    Collection, 
    GatewayIntentBits, 
    MessageFlags, 
    Partials } from "discord.js"

import { collectFromStream } from "./agent/endpoint.ts"
import { getSessionManager } from "./agent/sessions.ts"


// Extend the Client type to include 'commands'
declare module "discord.js" {
    interface Client {
        commands: Collection<string, any>
    }
}

import join from "./commands/join.ts"
import leave from "./commands/leave.ts"
import deafen from "./commands/deafen.ts"
import clean from "./commands/clean.ts"

process.loadEnvFile()

const sessionManager = await getSessionManager()

function isStringEmpty(str: string): boolean {
    return !str || str.trim() === ''
}

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
})

discord.commands = new Collection()
discord.commands.set(join.data.name, join)
discord.commands.set(leave.data.name, leave)
discord.commands.set(deafen.data.name, deafen)
discord.commands.set(clean.data.name, clean)

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
        return
    }
    if (message.author.bot) {
        console.log('Ignore other bots...')
        return
    }

    const userId = message.author.id
    const channelId = message.channel.id
    const channel = message.channel
    const content = message.content

    // Direct Message
    if (message.guild === null) {
        await channel.sendTyping()
        
        try {
            const uuid = await sessionManager.getUserSession(userId)
            const msg: ChatMessage = { user_id: userId, content: content, session_uuid: uuid }

            const response = await collectFromStream(msg)
            if (response && !isStringEmpty(response)) await channel.send(response)
            else console.warn("Warning: Cannot send empty message.")
        } catch (error) {
            console.error(error)
            await channel.send("Unable to process your request at the moment.")
        }
        return
    }

    // Mentions and Replies
    if (message.mentions.has(discord.user || '') || message.reference) {
        await channel.sendTyping()

        try {
            const uuid = await sessionManager.getChannelSession(channelId)
            const msg: ChatMessage = { user_id: userId, content: content, session_uuid: uuid }

            const response = await collectFromStream(msg)
            if (response && !isStringEmpty(response)) await message.reply(response)
            else console.warn("Warning: Cannot send empty message.")
        } catch (error) {
            console.error(error)
            await message.reply("Unable to process your request at the moment.")
        }
        return
    }
});

discord.once(Events.ClientReady, async () => {
    if (discord.user) {
        console.log(`Logged in as ${discord.user.tag}`);
    } else {
        console.log('Logged in, but user is not available.');
    }

    // Start the REST API server once Discord client is ready
    try {
        const { startAPIServer } = await import('./server.ts');
        startAPIServer(discord);
    } catch (error) {
        console.error('Failed to start REST API server:', error);
    }

    // Uncomment the following lines to clear all commands (for debugging purposes)
    // const guild = discord.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    // discord.application.commands.set([]);
    // guild?.commands.set([]);
});

discord.login(process.env.DISCORD_API_KEY)
