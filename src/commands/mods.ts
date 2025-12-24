import {
	type ChatInputCommandInteraction,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import ServerTracker from "../managers/serverTracker";
import type { ExtendedClient } from "../types/ExtendedClient";
import { updateMessage } from "./server";

export default {
	data: new SlashCommandBuilder()
		.setName("mods")
		.setDescription(
			"Provides utility commands to moderators to manage server tracking.",
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("server-trackers")
				.setDescription("Updates the number of server slots.")
				.addIntegerOption((option) =>
					option
						.setName("slots")
						.setDescription("The number of server slots to set.")
						.setRequired(true)
						.setMinValue(1),
				)
				.addBooleanOption((option) =>
					option
						.setName("force")
						.setDescription("Force the update even if it would end servers."),
				),
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(
		interaction: ChatInputCommandInteraction & { client: ExtendedClient },
	) {
		interaction.options.getSubcommand();

		if (interaction.options.getSubcommand() === "server-trackers") {
			const slots = interaction.options.getInteger("slots", true);

			if (slots < interaction.client.servers.length) {
				const indexOfInactive = [];
				for (const server of interaction.client.servers) {
					if (!server.current) {
						indexOfInactive.push(interaction.client.servers.indexOf(server));
					}
				}

				console.log(
					`1: ${
						slots <
							interaction.client.servers.length - indexOfInactive.length &&
						!interaction.options.getBoolean("force")
					}`,
				);

				if (
					slots < interaction.client.servers.length - indexOfInactive.length &&
					!interaction.options.getBoolean("force")
				) {
					console.log(
						`Moderator ${interaction.user.username} attempted to reduce server trackers to ${slots} but there are ${interaction.client.servers.length} servers`,
					);
					await interaction.reply(
						`Cannot reduce server trackers to ${slots} as there are active servers. Use the 'force' option to override.`,
					);
					return;
				} else {
					console.log(
						`Moderator ${interaction.user.username} reduced server trackers to ${slots} when there are ${interaction.client.servers.length} servers`,
					);

					// Remove inactive servers first
					indexOfInactive.sort((a, b) => b - a);

					for (const index of indexOfInactive) {
						if (interaction.client.servers.length <= slots) break;
						interaction.client.servers.splice(index, 1);
					}

					// If still need to remove more, remove from the end
					while (interaction.client.servers.length > slots) {
						const ended = interaction.client.servers.pop();

						if (ended) {
							ended.updateTime();
							ended.endSession();
							ServerTracker.saveStats();
							ServerTracker.loadStats();
						}
					}
				}
			} else if (slots > interaction.client.servers.length) {
				console.log(
					`Moderator ${interaction.user.username} resized ${interaction.client.servers.length} slots to ${slots}`,
				);

				// Add new server slots
				for (let i = interaction.client.servers.length; i < slots; i++) {
					interaction.client.servers.push(new ServerTracker());
				}
			}

			updateMessage(interaction.client);

			interaction.reply(
				`Server trackers updated to ${slots}. Current active servers: ${interaction.client.servers.length}.`,
			);
		}
	},
};
