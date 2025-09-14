import fs from "fs";
import path from "path";
import { REST, Routes } from "discord.js";

import join from "./src/commands/voice/join.js"
import leave from "./src/commands/voice/leave.js"
import clean from "./src/commands/clean.js"

process.loadEnvFile();

const commands = [];
commands.push(join.data.toJSON());
commands.push(leave.data.toJSON());
commands.push(clean.data.toJSON());

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_API_KEY);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();