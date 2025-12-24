import { type Client, Events } from "discord.js";

export default {
	name: Events.ClientReady,
	execute: (readyClient: Client<true>) => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	},
};
