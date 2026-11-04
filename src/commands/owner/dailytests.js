const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const supabase = require("../../database/supabase");
const config = require("../../config/config");
const emojis = require("../../config/emojis");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dailytests")
        .setDescription("View today's testing statistics"),

    async execute(interaction) {

        await interaction.deferReply({ flags: 64 });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: results, error } = await supabase
            .from("results")
            .select("tester_id, gamemode, new_tier")
            .gte("created_at", startOfDay.toISOString());

        if (error) {
            console.error("Daily Tests Error:", error);

            return interaction.editReply({
                content: "<:crosss:1567480131713241108> Failed to load today's testing statistics."
            });
        }

        if (!results || results.length === 0) {
            return interaction.editReply({
                content: "📊 No tests have been completed today."
            });
        }

        // Tester stats
        const testers = {};

        for (const result of results) {
            if (!result.tester_id) continue;

            if (!testers[result.tester_id]) {
                testers[result.tester_id] = 0;
            }

            testers[result.tester_id]++;
        }

        const leaderboard = Object.entries(testers)
            .sort((a, b) => b[1] - a[1]);

        const testerText = leaderboard
            .map(([id, count], index) =>
                `${emojis.tester} **${index + 1}.** <@${id}> — **${count}**`
            )
            .join("\n");

        // Gamemode stats
        const gamemodes = {};

        for (const result of results) {
            if (!gamemodes[result.gamemode]) {
                gamemodes[result.gamemode] = 0;
            }

            gamemodes[result.gamemode]++;
        }

        const gamemodeText = Object.entries(gamemodes)
            .sort((a, b) => b[1] - a[1])
            .map(([gamemode, count]) => {
                const emoji = emojis.gamemodes[gamemode] || "";
                return `${emoji} **${gamemode}** — **${count}**`;
            })
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle("📊 Daily Testing Statistics")
            .setDescription(
                `Today's testing activity in **${interaction.guild.name}**`
            )
            .addFields(
                {
                    name: "🧪 Total Tests",
                    value: `**${results.length}**`,
                    inline: true
                },
                {
                    name: "👥 Active Testers",
                    value: `**${leaderboard.length}**`,
                    inline: true
                },
                {
                    name: "🏆 Tester Activity",
                    value: testerText || "No tester data.",
                    inline: false
                },
                {
                    name: "🎮 Gamemode Breakdown",
                    value: gamemodeText || "No gamemode data.",
                    inline: false
                }
            )
            .setFooter({
                text: "AsianTiers • Daily Tests"
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });
    }
};