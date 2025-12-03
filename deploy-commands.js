import { REST, Routes } from "discord.js";

import join from "./src/commands/join.ts"
import leave from "./src/commands/leave.ts"
import deafen from "./src/commands/deafen.ts";
import clean from "./src/commands/clean.ts"
import register from "./src/commands/register.ts";

process.loadEnvFile();

const commands = [];
commands.push(clean.data.toJSON());

const guildCommands = [];
guildCommands.push(join.data.toJSON());
guildCommands.push(leave.data.toJSON());
guildCommands.push(deafen.data.toJSON());
guildCommands.push(register.data.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_API_KEY);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length + guildCommands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
			{ body: commands },
		);
		const guildData = await rest.put(
			Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
			{ body: guildCommands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
		console.log(`Successfully reloaded ${guildData.length} guild application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();