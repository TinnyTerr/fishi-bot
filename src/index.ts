import fs from "node:fs";
import path from "node:path";
import {
	Collection,
	GatewayIntentBits,
	MessageFlags,
	REST,
	Routes,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
	time,
} from "discord.js";
import { clientId, token } from "../data/config.json";
import serverTracker from "./managers/serverTracker";
import { ExtendedClient } from "./types/ExtendedClient";

export const client = new ExtendedClient({
	intents: [GatewayIntentBits.Guilds],
});

client.servers = [new serverTracker()];
const commands = [];
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath);

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const { default: command } = require(filePath);
	if ("data" in command && "execute" in command) {
		client.commands.set(command.data.name, command);
		commands.push(command.data.toJSON());
	} else {
		console.log(
			`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
		);
	}
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
	.readdirSync(eventsPath)
	.filter((file) => file.endsWith(".ts"));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const { default: event } = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}

	console.log(`Loaded event: ${event.name}`);
}

const rest = new REST().setToken(token);

(async () => {
	try {
		console.log(
			`Started refreshing ${commands.length} application (/) commands.`,
		);

		const data = await rest.put(Routes.applicationCommands(clientId), {
			body: commands,
		});

		console.log(
			`Successfully reloaded ${(data as { [key: string]: unknown }).length} application (/) commands.`,
		);
	} catch (error) {
		console.error(error);
	}
})();

client.login(token);

const channel = await (
	await client.guilds.fetch("1448336561803366444")
).channels.fetch("1452086244002631781");

const separator = new SeparatorBuilder()
	.setDivider(true)
	.setSpacing(SeparatorSpacingSize.Large);

const content = new TextDisplayBuilder().setContent(
	`# Server List\r\nA list of currently active servers.`,
);

const codes = [];

for (let i = 0; i < client.servers.length; i++) {
	const server = client.servers[i];
	if (server?.current && server.start) {
		codes[i] = new TextDisplayBuilder();
		const code = codes[i] as TextDisplayBuilder;
		const startedAt = time(Math.floor(server.start.getTime() / 1000));
		code.setContent(
			`## Server ${i + 1}\r\nOwner: <@${server.current}>\r\nStarted At: ${startedAt}\r\nCode: ${server.code}\r\n`,
		);
	}
}

const none = new TextDisplayBuilder().setContent(
	`**No active servers at the moment.**`,
);

const lastUpdated = new TextDisplayBuilder().setContent(
	`-# Last Updated ${time(Math.floor(Date.now() / 1000))}`,
);

const contents = codes.length === 0 ? [none] : [...codes];
channel?.isTextBased()
	? channel
			.send({
				flags: [MessageFlags.IsComponentsV2],
				components: [content, separator, ...contents, separator, lastUpdated],
			})
			.then((v) => {
				client.messageId = v.id;
			})
	: (() => {
			throw `unsendable channel type: ${channel?.type}`;
		})();
