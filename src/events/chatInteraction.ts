import { Events, type Interaction, MessageFlags } from "discord.js";
import type { ExtendedClient } from "../types/ExtendedClient";

export default {
    name: Events.InteractionCreate,
	async execute(interaction: Interaction & { client: ExtendedClient }) {
		if (!interaction.isChatInputCommand()) return;

        console.log(`Interaction received: ${interaction.commandName} ${interaction.options.getSubcommandGroup(false) ?? '{no subcommand group}'} ${interaction.options.getSubcommand(false) ?? '{no subcommand}'} `);

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			} else {
				await interaction.reply({
					content: 'There was an error while executing this command!',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

        console.log(`Interaction ended: ${interaction.commandName}`);
	}
}