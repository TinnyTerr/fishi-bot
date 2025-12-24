import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Provides information about available commands."),
    async execute(interaction: ChatInputCommandInteraction) {
        const embed = new EmbedBuilder()
            .setTitle("Help - Available Commands")
            .setDescription(
                "Here are the available commands:\n\n" +
                    "/server start [server_code] - Starts tracking a new server session. \n" +
                    "/server status - Displays the current server ownership status.\n" +
                    "/server end - Ends the current server session.\n" +
                    "/server stats - Displays server/your statistics." +
                    "/server opt-out - Opts out of server tracking.",
            )
            .setColor(0x00ff00);

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}