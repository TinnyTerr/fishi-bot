import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
	SeparatorBuilder,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	type Snowflake,
	TextDisplayBuilder,
	time,
} from "discord.js";
import serverTracker from "../managers/serverTracker";
import type { ExtendedClient } from "../types/ExtendedClient";

export default {
	data: new SlashCommandBuilder()
		.setName("server")
		.setDescription("Updates the ownership of the current server.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("start")
				.setDescription(
					"Starts the server, overwriting any existing ownership.",
				)
				.addStringOption((option) =>
					option
						.setName("server_code")
						.setDescription("The server code to start tracking.")
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("status")
				.setDescription("Displays the current server ownership status."),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("end")
				.setDescription("Ends the current server session."),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("stats").setDescription("Displays server statistics."),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("opt-out")
				.setDescription("Opts out of server tracking."),
		),
	async execute(
		interaction: ChatInputCommandInteraction & { client: ExtendedClient },
	) {
		const subcommand = interaction.options.getSubcommand();
		if (findOwnerServer(interaction.user.id, interaction.client.servers)) {
			findOwnerServer(
				interaction.user.id,
				interaction.client.servers,
			)?.updateTime();
			serverTracker.saveStats();
			serverTracker.loadStats();
		}

		if (subcommand === "start") {
			const availableServer = findFirstAvailableServer(
				interaction.client.servers,
			);
			if (availableServer.current === null) {
				const code = interaction.options.getString("server_code", true);

				availableServer.newServer(interaction.user.id, code);
				await interaction.reply(
					`Server started. If you do not end or transfer ownership, you will recieve 10% of the hours tracked.\r\n\r\nFor example, if you host the server for 2 hours, but if someone only claims the server 2 hours afterwards, you gain 10% of the 4 hours (24 minutes) total you were "hosting" the server.`,
				);

				updateMessage(interaction.client);
			} else {
				const confirm = new ButtonBuilder()
					.setCustomId("confirm")
					.setLabel("Confirm Actions")
					.setStyle(ButtonStyle.Primary);

				const row = new ActionRowBuilder().addComponents(confirm).toJSON();

				const response = await interaction.reply({
					content: `All server slots are currently occupied. We must now go through the servers in order to take ownership of one.`,
					components: [row],
					withResponse: true,
				});

				try {
					const confirmation =
						await response.resource?.message?.awaitMessageComponent({
							filter: (i) => i.user.id === interaction.user.id,
							time: 300_000,
						});

					if (confirmation?.customId === "confirm") {
						const servers = interaction.client.servers;
						servers.sort(
							(a, b) =>
								(a.start as Date).getTime() - (b.start as Date).getTime(),
						);

						for (const index in servers) {
							const tracker = servers[index] as serverTracker;

							const overwrite = new ButtonBuilder()
								.setCustomId("overwrite")
								.setLabel("Overwrite (Admin)")
								.setStyle(ButtonStyle.Danger);
							const end = new ButtonBuilder()
								.setCustomId("end")
								.setLabel("End Session")
								.setStyle(ButtonStyle.Primary);
							const ignore = new ButtonBuilder()
								.setCustomId("ignore")
								.setLabel("Ignore")
								.setStyle(ButtonStyle.Secondary);

							const row = new ActionRowBuilder()
								.addComponents(overwrite, end, ignore)
								.toJSON();

							const overwriteDisabled = new ButtonBuilder()
								.setCustomId("overwrite")
								.setLabel("Overwrite (Admin)")
								.setDisabled(true)
								.setStyle(ButtonStyle.Danger);
							const endDisabled = new ButtonBuilder()
								.setCustomId("end")
								.setLabel("End Session")
								.setDisabled(true)
								.setStyle(ButtonStyle.Primary);
							const ignoreDisabled = new ButtonBuilder()
								.setCustomId("ignore")
								.setLabel("Ignore")
								.setDisabled(true)
								.setStyle(ButtonStyle.Secondary);

							const rowDisabled = new ActionRowBuilder()
								.addComponents(overwriteDisabled, endDisabled, ignoreDisabled)
								.toJSON();

							const response = await confirmation.reply({
								content: `<@${tracker.current}> currently owns server ${index + 1}, please respond before ${time(Math.floor(Date.now() / 1000) + 60 * 5, "t")}. The below buttons are for the current server owner.`,
								components: [row],
								withResponse: true,
							});
							//
							// biome-ignore lint/suspicious/noExplicitAny: unavoidable
							const filter = (i: any) =>
								i.user.id === tracker.current ||
								(i.customId === "overwrite" &&
									i.memberPermissions?.has("Administrator"));
							try {
								const confirmation =
									await response.resource?.message?.awaitMessageComponent({
										filter,
										time: 300_000,
									});

								if (confirmation?.customId === "end") {
									tracker.updateTime();
									tracker.endSession();
									tracker.newServer(
										interaction.user.id,
										interaction.options.getString("server_code", true),
									);
									serverTracker.saveStats();
									serverTracker.loadStats();

									await confirmation.update({
										content:
											"Previous server session ended. You are now the owner.",
										components: [rowDisabled],
									});

									updateMessage(interaction.client);
								} else if (confirmation?.customId === "overwrite") {
									tracker.updateTime(true);
									tracker.endSession();
									tracker.newServer(
										interaction.user.id,
										interaction.options.getString("server_code", true),
									);
									serverTracker.saveStats();
									serverTracker.loadStats();

									await confirmation.update({
										content: "Server ownership overwritten.",
										components: [rowDisabled],
									});

									updateMessage(interaction.client);
								} else if (confirmation?.customId === "ignore") {
									await confirmation.update({
										content: "Action ignored, server ownership not changed.",
										components: [rowDisabled],
									});
								}
							} catch {
								await interaction.editReply({
									content:
										"Confirmation not received within 5 minutes, server ownership changed to new user.",
									components: [rowDisabled],
								});

								tracker.updateTime(true);
								tracker.endSession();
								tracker.newServer(
									interaction.user.id,
									interaction.options.getString("server_code", true),
								);
								serverTracker.saveStats();
								serverTracker.loadStats();

								updateMessage(interaction.client);
							}
						}
					}
				} catch {}
			}
		} else if (subcommand === "status") {
			let running = false;
			const separator = new SeparatorBuilder()
				.setDivider(true)
				.setSpacing(SeparatorSpacingSize.Large);

			const content = new TextDisplayBuilder().setContent(
				`# Server List\r\nA list of currently active servers.`,
			);

			const codes = [];

			for (let i = 0; i < interaction.client.servers.length; i++) {
				const server = interaction.client.servers[i];
				if (server?.current && server.start) {
					codes[i] = new TextDisplayBuilder();
					const code = codes[i] as TextDisplayBuilder;
					const startedAt = time(Math.floor(server.start.getTime() / 1000));
					code.setContent(
						`## Server ${i + 1}\r\nOwner: <@${server.current}>\r\nStarted At: ${startedAt}\r\nCode: ${server.code}\r\n`,
					);

					running = true;
				}
			}

			const none = new TextDisplayBuilder().setContent(
				`**No active servers at the moment.**`,
			);

			const lastUpdated = new TextDisplayBuilder().setContent(
				`-# Last Updated ${time(Math.floor(Date.now() / 1000))}`,
			);

			const contents = codes.length === 0 ? [none] : [...codes];

			if (!running) {
				await interaction.reply("No server is currently being tracked.");
			} else {
				interaction.reply({
					flags: [MessageFlags.IsComponentsV2],
					components: [content, separator, ...contents, separator, lastUpdated],
				});
			}

			updateMessage(interaction.client);
		} else if (subcommand === "end") {
			const server = findOwnerServer(
				interaction.user.id,
				interaction.client.servers,
			);
			if (server) {
				server.updateTime();
				server.endSession();
				serverTracker.saveStats();
				serverTracker.loadStats();

				updateMessage(interaction.client);

				interaction.reply("Your server session has been ended.");
			} else {
				await interaction.reply("You are not the current server owner.");
			}
		} else if (subcommand === "stats") {
			serverTracker.saveStats();

			const totalTime = [...serverTracker.stats.entries()];

			totalTime.sort((a, b) => b[1] - a[1]);

			let statsMessage = "";

			for (let i = 0; i < 9; i++) {
				const time = totalTime[i];
				if (!time) continue;
				const timeHours = Math.floor(time[1] / 3600).toFixed(2);
				const timeMinutes = Math.floor((time[1] % 3600) / 60).toFixed(0);
				const dateString = `${timeHours !== "0" ? `${timeHours} hours` : ""} ${timeMinutes} minutes`;
				statsMessage += `${i + 1}. <@${time[0]}>: ${dateString}\n`;
			}

			const time = serverTracker.stats.get(interaction.user.id) ?? 0;

			const hours = Math.floor(time / 3600).toFixed(2);
			const minutes = Math.floor((time % 3600) / 60).toFixed(2);

			const dateString = `${hours !== "0" ? `${hours} hours` : ""} ${minutes} minutes`;

			const embed = new EmbedBuilder()
				.setTitle("Server Ownership Statistics")
				.setFields([
					{ name: "Top Owners", value: statsMessage },
					{
						name: "Your Time",
						value: dateString,
					},
				]);

			await interaction.reply({ embeds: [embed] });
		} else if (subcommand === "opt-out") {
			if (!serverTracker.ignored.has(interaction.user.id)) {
				serverTracker.ignored.add(interaction.user.id);
				await serverTracker.saveStats();
				await interaction.reply("You have opted out of server tracking.");
			} else {
				serverTracker.ignored.delete(interaction.user.id);
				await serverTracker.saveStats();
				await interaction.reply("You have opted back into server tracking.");
			}
		}
	},
};

function findFirstAvailableServer(servers: serverTracker[]): serverTracker {
	for (const element of servers) {
		if (element.current === null) {
			return element;
		}
	}

	return servers.sort(
		(a, b) => (a.start as Date).getTime() - (b.start as Date).getTime(),
	)[0] as serverTracker;
}

function findOwnerServer(
	owner: Snowflake,
	servers: serverTracker[],
): serverTracker | null {
	for (const element of servers) {
		if (element.current === owner) {
			return element;
		}
	}

	return null;
}

export async function updateMessage(client: ExtendedClient) {
	console.log("Updating server list message...");

	const channel = await (
		await client.guilds.fetch("1448336561803366444")
	).channels.fetch("1452086244002631781");
	const message = channel?.isTextBased()
		? await channel.messages.fetch(client.messageId)
		: null;

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
	message
		? message
				.edit({
					flags: [MessageFlags.IsComponentsV2],
					components: [content, separator, ...contents, separator, lastUpdated],
				})
				.then((v) => {
					client.messageId = v.id;
				})
		: (() => {
				throw `unsendable message: ${message}`;
			})();

	console.log("Updated server list message");
}
