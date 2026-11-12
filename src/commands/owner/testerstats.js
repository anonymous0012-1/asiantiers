const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const supabase = require("../../database/supabase");
const config = require("../../config/config");
const emojis = require("../../config/emojis");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("testerstats")
        .setDescription("View a tester's complete testing statistics")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The tester")
                .setRequired(true)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser("user");

        await interaction.deferReply({ flags: 64 });

        const { data: results, error } = await supabase
            .from("results")
            .select(
                "discord_id, ign, gamemode, new_tier, tester_id, created_at"
            )
            .eq("tester_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {

            console.error("Tester Stats Error:", error);

            return interaction.editReply({
                content: "<:crosss:1570104768628531290> Failed to load tester statistics."
            });
        }

        if (!results || results.length === 0) {

            return interaction.editReply({
                content:
                    `📊 **${user.username}** has not completed any tests yet.`
            });
        }

        // ==========================================
        // TOTAL
        // ==========================================

        const totalTests = results.length;

        // ==========================================
        // GAMEMODE STATS
        // ==========================================

        const gamemodeStats = {};

        for (const result of results) {

            if (!gamemodeStats[result.gamemode]) {
                gamemodeStats[result.gamemode] = 0;
            }

            gamemodeStats[result.gamemode]++;
        }

        const gamemodeText = Object.entries(gamemodeStats)
            .sort((a, b) => b[1] - a[1])
            .map(([gamemode, count]) => {

                const emoji =
                    emojis.gamemodes[gamemode] || "";

                return `${emoji} **${gamemode}** — **${count} tests**`;
            })
            .join("\n");

        // ==========================================
        // TIER STATS
        // ==========================================

        const tierStats = {};

        for (const result of results) {

            const tier = result.new_tier || "Unknown";

            if (!tierStats[tier]) {
                tierStats[tier] = 0;
            }

            tierStats[tier]++;
        }

        const tierOrder = [
            "HT1",
            "LT1",
            "HT2",
            "LT2",
            "HT3",
            "LT3",
            "HT4",
            "LT4",
            "HT5",
            "LT5",
            "Unranked",
            "Unknown"
        ];

        const tierText = tierOrder
            .filter(tier => tierStats[tier])
            .map(tier =>
                `**${tier}** — **${tierStats[tier]}**`
            )
            .join("\n");

        // ==========================================
        // GAMEMODE + TIER
        // ==========================================

        const detailedStats = {};

        for (const result of results) {

            const gamemode = result.gamemode;
            const tier = result.new_tier || "Unknown";

            if (!detailedStats[gamemode]) {
                detailedStats[gamemode] = {};
            }

            if (!detailedStats[gamemode][tier]) {
                detailedStats[gamemode][tier] = 0;
            }

            detailedStats[gamemode][tier]++;
        }

        const detailedText = Object.entries(detailedStats)
            .map(([gamemode, tiers]) => {

                const emoji =
                    emojis.gamemodes[gamemode] || "";

                const tiersText = tierOrder
                    .filter(tier => tiers[tier])
                    .map(tier =>
                        `**${tier}** × ${tiers[tier]}`
                    )
                    .join(" • ");

                return `${emoji} **${gamemode}**\n${tiersText}`;

            })
            .join("\n\n");

        // ==========================================
        // EMBED
        // ==========================================

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle("🧪 Tester Statistics")
            .setThumbnail(
                user.displayAvatarURL({
                    dynamic: true,
                    size: 256
                })
            )
            .setDescription(
                `${emojis.tester} **Tester:** <@${user.id}>\n` +
                `📊 Complete testing statistics`
            )
            .addFields(
                {
                    name: "🧪 Total Tests",
                    value: `**${totalTests}**`,
                    inline: true
                },
                {
                    name: "🎮 Gamemodes Tested",
                    value: `**${Object.keys(gamemodeStats).length}**`,
                    inline: true
                },
                {
                    name: "🏆 Different Tiers",
                    value: `**${Object.keys(tierStats).length}**`,
                    inline: true
                },
                {
                    name: "🎮 Tests By Gamemode",
                    value: gamemodeText || "No data.",
                    inline: false
                },
                {
                    name: "🏆 Tiers Given",
                    value: tierText || "No data.",
                    inline: false
                },
                {
                    name: "<:updates:1570104881262366861> Detailed Breakdown",
                    value:
                        detailedText.length > 1024
                            ? detailedText.substring(0, 1020) + "..."
                            : detailedText,
                    inline: false
                }
            )
            .setFooter({
                text: "UniversalTiers • Tester Statistics"
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });
    }
};