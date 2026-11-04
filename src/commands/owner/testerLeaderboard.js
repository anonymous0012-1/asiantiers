const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const supabase = require("../../database/supabase");
const config = require("../../config/config");
const emojis = require("../../config/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("testerleaderboard")
        .setDescription("Show the tester leaderboard"),

    async execute(interaction) {

        await interaction.deferReply({ flags: 64 });

        try {

            const { data: results, error } = await supabase
                .from("results")
                .select("tester_id");

            if (error) {
                console.error("Tester Leaderboard Error:", error);

                return interaction.editReply({
                    content: "<:crosss:1567480131713241108> Failed to load the tester leaderboard."
                });
            }

            if (!results || results.length === 0) {

                const embed = new EmbedBuilder()
                    .setColor(config.colors.primary)
                    .setTitle("🏆 Tester Leaderboard")
                    .setDescription("No tests have been completed yet.")
                    .setFooter({
                        text: "AsianTiers • Tester Leaderboard"
                    })
                    .setTimestamp();

                return interaction.editReply({
                    embeds: [embed]
                });
            }

            // Count tests
            const testerCounts = {};

            for (const result of results) {

                if (!result.tester_id) continue;

                testerCounts[result.tester_id] =
                    (testerCounts[result.tester_id] || 0) + 1;
            }

            const leaderboard = Object.entries(testerCounts)
                .sort((a, b) => b[1] - a[1]);

            // Leaderboard text
            const leaderboardText = leaderboard
                .map(([testerId, count], index) => {

                    let position;

                    if (index === 0) {
                        position = "🥇";
                    } else if (index === 1) {
                        position = "🥈";
                    } else if (index === 2) {
                        position = "🥉";
                    } else {
                        position = `**${index + 1}.**`;
                    }

                    return `${position} ${emojis.tester} <@${testerId}> — **${count} tests**`;
                })
                .join("\n");

            const embed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle("🏆 Tester Leaderboard")
                .setDescription(
                    `Top testers ranked by their total completed tests.\n\n${leaderboardText}`
                )
                .addFields(
                    {
                        name: "🧪 Total Tests",
                        value: `**${results.length}**`,
                        inline: true
                    },
                    {
                        name: "👥 Testers",
                        value: `**${leaderboard.length}**`,
                        inline: true
                    }
                )
                .setFooter({
                    text: "AsianTiers • Tester Leaderboard"
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {

            console.error("Tester Leaderboard Error:", error);

            await interaction.editReply({
                content: "<:crosss:1567480131713241108> Something went wrong while loading the leaderboard."
            }).catch(() => {});
        }
    }
};