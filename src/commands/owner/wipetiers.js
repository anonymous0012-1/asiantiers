const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

const config = require("../../config/config");
const supabase = require("../../database/supabase");
const fetch = require("node-fetch");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("wipetiers")
        .setDescription("Remove all tiers from a player")
        .addStringOption(option =>
            option
                .setName("user_id")
                .setDescription("Discord User ID of the player")
                .setRequired(true)
        ),

    async execute(interaction) {

        // ==========================================
        // OWNER ONLY
        // ==========================================

        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: "<:crosss:1567480131713241108> Only the bot owner can use this command.",
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {

            const userId =
                interaction.options.getString("user_id").trim();

            // ==========================================
            // BASIC DISCORD ID CHECK
            // ==========================================

            if (!/^\d{17,20}$/.test(userId)) {
                return interaction.editReply({
                    content:
                        "<:crosss:1567480131713241108> Invalid Discord User ID.\n\nExample: `123456789012345678`"
                });
            }

            // ==========================================
            // GET PLAYER FROM DATABASE
            // ==========================================

            const {
                data: player,
                error: playerError
            } = await supabase
                .from("players")
                .select("*")
                .eq("discord_id", userId)
                .maybeSingle();

            if (playerError) {

                console.error(
                    "PLAYER LOOKUP ERROR:",
                    playerError
                );

                return interaction.editReply({
                    content:
                        "<:crosss:1567480131713241108> Database error while finding the player."
                });
            }

            if (!player) {
                return interaction.editReply({
                    content:
                        `<:crosss:1567480131713241108> No player profile was found for Discord ID:\n\`${userId}\``
                });
            }

            // ==========================================
            // GET DISCORD MEMBER
            // PLAYER MAY HAVE LEFT THE SERVER
            // ==========================================

            let member = null;

            try {
                member =
                    await interaction.guild.members.fetch(userId);
            } catch (error) {
                console.log(
                    `ℹ️ ${userId} is not currently in the server.`
                );
            }

            // ==========================================
            // REMOVE DISCORD TIER ROLES
            // ONLY IF MEMBER IS IN SERVER
            // ==========================================

            let removed = 0;

            if (member) {

                for (
                    const gamemode
                    of Object.keys(config.tiers || {})
                ) {

                    const tierRoles =
                        Object.values(
                            config.tiers[gamemode]
                        ).filter(Boolean);

                    for (const roleId of tierRoles) {

                        if (
                            member.roles.cache.has(roleId)
                        ) {

                            try {

                                await member.roles.remove(
                                    roleId,
                                    "All tiers wiped by bot owner"
                                );

                                removed++;

                            } catch (roleError) {

                                console.error(
                                    `<:crosss:1567480131713241108> Failed removing role ${roleId}:`,
                                    roleError
                                );
                            }
                        }
                    }
                }

            } else {

                console.log(
                    "ℹ️ Player left server, skipping Discord role removal."
                );
            }

            // ==========================================
            // WEBSITE SYNC
            // ==========================================

            const gamemodes =
                Object.keys(config.tiers || {});

            let websiteSuccess = 0;
            let websiteFailed = 0;

            if (!process.env.WEBSITE_API_URL) {

                console.error(
                    "<:crosss:1567480131713241108> WEBSITE_API_URL is missing from .env"
                );

                return interaction.editReply({
                    content:
                        "<:crosss:1567480131713241108> WEBSITE_API_URL is missing from `.env`."
                });
            }

            if (!process.env.WEBSITE_BOT_SECRET) {

                console.error(
                    "<:crosss:1567480131713241108> WEBSITE_BOT_SECRET is missing from .env"
                );

                return interaction.editReply({
                    content:
                        "<:crosss:1567480131713241108> WEBSITE_BOT_SECRET is missing from `.env`."
                });
            }

            for (const gamemode of gamemodes) {

                try {

                    const response =
                        await fetch(
                            process.env.WEBSITE_API_URL,
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    "X-Bot-Secret":
                                        process.env.WEBSITE_BOT_SECRET
                                },

                                body: JSON.stringify({

                                    // Discord ID
                                    userId: userId,

                                    // Existing website profile
                                    ign: player.ign,

                                    // Remove tier
                                    tier: "Unranked",

                                    gamemode:
                                        gamemode.toLowerCase(),

                                    guildId:
                                        interaction.guildId
                                })
                            }
                        );

                    const responseText =
                        await response.text();

                    if (!response.ok) {

                        websiteFailed++;

                        console.error(
                            `<:crosss:1567480131713241108> Website Sync Failed [${gamemode}]`,
                            response.status,
                            responseText
                        );

                    } else {

                        websiteSuccess++;

                        console.log(
                            `<:tick:1567480091267825714> Website synced: ${player.ign} → ${gamemode} → Unranked`
                        );
                    }

                } catch (error) {

                    websiteFailed++;

                    console.error(
                        `<:crosss:1567480131713241108> Website Sync Error (${gamemode}):`,
                        error
                    );
                }
            }

            // ==========================================
            // FINAL RESPONSE
            // ==========================================

            let memberStatus;

            if (member) {
                memberStatus =
                    `Discord tier roles removed: **${removed}**`;
            } else {
                memberStatus =
                    `Discord member not in server — roles skipped`;
            }

            await interaction.editReply({
                content:
                    `🧹 **Tier Wipe Complete**\n\n` +

                    `**Player:** ${player.ign}\n` +

                    `**Discord ID:** \`${userId}\`\n\n` +

                    `${memberStatus}\n` +

                    `Website gamemodes reset: **${websiteSuccess}/${gamemodes.length}**\n` +

                    (websiteFailed > 0
                        ? `⚠️ Website failures: **${websiteFailed}**\n\n`
                        : `\n`) +

                    `All available gamemodes are now **Unranked**.`
            });

        } catch (error) {

            console.error(
                "WIPE TIERS ERROR:",
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.editReply({
                    content:
                        "<:crosss:1567480131713241108> An error occurred while wiping the player's tiers."
                }).catch(() => {});

            } else {

                await interaction.reply({
                    content:
                        "<:crosss:1567480131713241108> An error occurred while wiping the player's tiers.",
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
};