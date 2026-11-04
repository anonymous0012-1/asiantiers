const {
    SlashCommandBuilder
} = require("discord.js");

const config = require("../../config/config");
const supabase = require("../../database/supabase");
const fetch = require("node-fetch");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tierremove")
        .setDescription("Remove a player's tier")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Player")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("gamemode")
                .setDescription("Gamemode")
                .setRequired(true)
                .addChoices(
                    { name: "Sword", value: "Sword" },
                    { name: "Mace", value: "Mace" },
                    { name: "Axe", value: "Axe" },
                    { name: "Crystal", value: "Crystal" },
                    { name: "NethPot", value: "NethPot" },
                    { name: "DiaPot", value: "DiaPot" },
                    { name: "SMP", value: "SMP" },
                    { name: "UHC", value: "UHC" }
                )
        ),

    async execute(interaction) {

        // OWNER ONLY
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: "<:crosss:1567480131713241108> Only the bot owner can use this command.",
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        const user = interaction.options.getUser("user");
        const gamemode = interaction.options.getString("gamemode");

        // Get player
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("*")
            .eq("discord_id", user.id)
            .single();

        if (playerError || !player) {
            return interaction.editReply({
                content: "<:crosss:1567480131713241108> Player profile not found."
            });
        }

        // Get gamemode roles
        const gamemodeTiers = config.tiers?.[gamemode];

        if (!gamemodeTiers) {
            return interaction.editReply({
                content: `<:crosss:1567480131713241108> Tier roles for **${gamemode}** are not configured.`
            });
        }

        // Get Discord member
        const member = await interaction.guild.members.fetch(user.id);

        // Remove every tier role for this gamemode
        const tierRoles = Object.values(gamemodeTiers)
            .filter(Boolean);

        let removed = 0;

        for (const roleId of tierRoles) {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                removed++;
            }
        }

        // Save removal in result history
        const { error: resultError } = await supabase
            .from("results")
            .insert({
                discord_id: user.id,
                ign: player.ign,
                gamemode,
                previous_tier: "Removed",
                new_tier: "Unranked",
                tester_id: interaction.user.id
            });

        if (resultError) {
            console.error("Tier Remove DB Error:", resultError);
        }

        // Sync with website
        try {

            if (!process.env.WEBSITE_API_URL) {
                console.error("<:crosss:1567480131713241108> WEBSITE_API_URL is missing from .env");
            } else if (!process.env.WEBSITE_BOT_SECRET) {
                console.error("<:crosss:1567480131713241108> WEBSITE_BOT_SECRET is missing from .env");
            } else {

                const response = await fetch(
                    process.env.WEBSITE_API_URL,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Bot-Secret": process.env.WEBSITE_BOT_SECRET
                        },
                        body: JSON.stringify({
                            ign: player.ign,
                            tier: "Unranked",
                            gamemode: gamemode.toLowerCase(),
                            userId: user.id,
                            guildId: interaction.guildId
                        })
                    }
                );

                if (!response.ok) {
                    console.error(
                        "<:crosss:1567480131713241108> Website Sync Error:",
                        response.status,
                        await response.text()
                    );
                } else {
                    console.log(
                        `<:tick:1567480091267825714> Website synced: ${player.ign} → ${gamemode} → Unranked`
                    );
                }
            }

        } catch (error) {
            console.error(
                "<:crosss:1567480131713241108> Website Tier Remove Sync Failed:",
                error
            );
        }

        // Final response
        await interaction.editReply({
            content:
                `<:tick:1567480091267825714> **Tier Removed Successfully**\n\n` +
                `Player: **${player.ign}**\n` +
                `Gamemode: **${gamemode}**\n` +
                `Status: **Unranked**\n` +
                `Roles removed: **${removed}**`
        });
    }
};