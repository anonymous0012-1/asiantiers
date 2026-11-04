const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

const config = require("../../config/config");
const supabase = require("../../database/supabase");
const queueRenderer = require("../../queue/queueRenderer");
const perms = require("../../utils/permissions");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("waitlistnext")
        .setDescription(
            "Picks the next player from the queue and creates a ticket"
        ),

    async execute(interaction) {

        if (!perms.isTester(interaction.member)) {
            return interaction.reply({
                content: "Only testers can use this command.",
                flags: 64
            });
        }

        // =====================================================
        // ACKNOWLEDGE
        // =====================================================

        await interaction.deferReply({
            flags: 64
        });

        const gamemode =
            config.channels.queues[interaction.channelId];

        if (!gamemode) {
            return interaction.editReply({
                content:
                    "Use this command in a queue channel."
            });
        }

        // =====================================================
        // GET FULL QUEUE BEFORE REMOVING PLAYER
        // =====================================================

        const {
            data: oldMembers,
            error: oldQueueError
        } = await supabase
            .from("queue_members")
            .select("*")
            .eq("gamemode", gamemode)
            .order("priority", {
                ascending: false
            })
            .order("joined_at", {
                ascending: true
            });

        if (
            oldQueueError ||
            !oldMembers ||
            oldMembers.length === 0
        ) {
            if (oldQueueError) {
                console.error(
                    "WAITLISTNEXT QUEUE FETCH ERROR:",
                    oldQueueError
                );
            }

            return interaction.editReply({
                content: "Queue is empty."
            });
        }

        // =====================================================
        // NEXT PLAYER = #1
        // =====================================================

        const member = oldMembers[0];

        // =====================================================
        // GET PLAYER PROFILE
        // =====================================================

        const {
            data: player,
            error: playerError
        } = await supabase
            .from("players")
            .select("*")
            .eq(
                "discord_id",
                member.discord_id
            )
            .single();

        if (playerError || !player) {
            console.error(
                "PLAYER PROFILE ERROR:",
                playerError
            );

            return interaction.editReply({
                content:
                    "Player profile could not be found."
            });
        }

        // =====================================================
        // CREATE TICKET
        // =====================================================

        const guild = interaction.guild;

        let ticketChannel;

        try {

            ticketChannel =
                await guild.channels.create({
                    name: `test-${player.ign}`,
                    type: ChannelType.GuildText,
                    parent:
                        config.channels.ticketCategory,

                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [
                                PermissionFlagsBits.ViewChannel
                            ]
                        },
                        {
                            id: member.discord_id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages
                            ]
                        },
                        {
                            id: config.roles.tester,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages
                            ]
                        }
                    ]
                });

        } catch (error) {

            console.error(
                "TICKET CREATION ERROR:",
                error
            );

            return interaction.editReply({
                content:
                    "<:crosss:1567480131713241108> Failed to create the testing ticket."
            });
        }

        // =====================================================
        // SAVE TESTING SESSION
        // =====================================================

        const {
            error: sessionError
        } = await supabase
            .from("testing_sessions")
            .insert({
                player_discord_id:
                    member.discord_id,

                tester_id:
                    interaction.user.id,

                gamemode:
                    gamemode,

                ticket_channel_id:
                    ticketChannel.id
            });

        if (sessionError) {

            console.error(
                "TESTING SESSION INSERT ERROR:",
                sessionError
            );

            // Delete ticket if session couldn't be saved
            await ticketChannel.delete().catch(() => {});

            return interaction.editReply({
                content:
                    "<:crosss:1567480131713241108> Failed to create the testing session."
            });
        }

        // =====================================================
        // REMOVE PLAYER FROM QUEUE
        // =====================================================

        const {
            error: removeError
        } = await supabase
            .from("queue_members")
            .delete()
            .eq("id", member.id);

        if (removeError) {

            console.error(
                "QUEUE REMOVE ERROR:",
                removeError
            );

            return interaction.editReply({
                content:
                    "<:crosss:1567480131713241108> Failed to remove the player from the queue."
            });
        }

        // =====================================================
        // GET NEW QUEUE
        // =====================================================

        const {
            data: newMembers,
            error: newQueueError
        } = await supabase
            .from("queue_members")
            .select("*")
            .eq("gamemode", gamemode)
            .order("priority", {
                ascending: false
            })
            .order("joined_at", {
                ascending: true
            });

        if (newQueueError) {

            console.error(
                "NEW QUEUE FETCH ERROR:",
                newQueueError
            );
        }

        // =====================================================
        // POSITION CHANGE DMS
        // =====================================================

        if (
            newMembers &&
            !newQueueError
        ) {

            // Old positions
            const oldPositions = new Map();

            oldMembers.forEach(
                (queueMember, index) => {
                    oldPositions.set(
                        queueMember.discord_id,
                        index + 1
                    );
                }
            );

            // New positions
            const newPositions = new Map();

            newMembers.forEach(
                (queueMember, index) => {
                    newPositions.set(
                        queueMember.discord_id,
                        index + 1
                    );
                }
            );

            // Only notify players who are now #1 or #2
            for (
                const queueMember of newMembers
            ) {

                const newPosition =
                    newPositions.get(
                        queueMember.discord_id
                    );

                if (
                    newPosition !== 1 &&
                    newPosition !== 2
                ) {
                    continue;
                }

                const oldPosition =
                    oldPositions.get(
                        queueMember.discord_id
                    );

                // Position did not change
                if (
                    oldPosition === newPosition
                ) {
                    continue;
                }

                try {

                    const user =
                        await interaction.client.users.fetch(
                            queueMember.discord_id
                        );

                    const positionEmbed =
                        new EmbedBuilder()
                            .setColor(
                                config.colors.primary
                            )
                            .setTitle(
                                newPosition === 1
                                    ? "🔔 You are #1"
                                    : "🔔 You are #2"
                            )
                            .setDescription(
                                newPosition === 1
                                    ? `You are now **#1** in the **${gamemode}** queue.\n\nPlease be ready. Your testing ticket will be opened shortly.`
                                    : `You are now **#2** in the **${gamemode}** queue.\n\nPlease be ready for your test.`
                            )
                            .setFooter({
                                text:
                                    "AsianTiers • Testing Queue"
                            });

                    await user.send({
                        embeds: [positionEmbed]
                    });

                } catch (dmError) {

                    console.error(
                        `POSITION DM FAILED [${queueMember.discord_id}]:`,
                        dmError.message
                    );
                }
            }
        }

        // =====================================================
        // UPDATE QUEUE PANEL
        // =====================================================

        try {

            await queueRenderer.updateQueuePanel(
                interaction.client,
                gamemode
            );

        } catch (error) {

            console.error(
                "QUEUE PANEL UPDATE ERROR:",
                error
            );
        }

        // =====================================================
        // GET PREVIOUS RESULT
        // =====================================================

        const {
            data: lastResult
        } = await supabase
            .from("results")
            .select("new_tier")
            .eq(
                "discord_id",
                member.discord_id
            )
            .eq(
                "gamemode",
                gamemode
            )
            .order("created_at", {
                ascending: false
            })
            .limit(1)
            .maybeSingle();

        // =====================================================
        // TICKET EMBED
        // =====================================================

        const gameEmoji =
            require("../../config/emojis")
                .gamemodes?.[gamemode] || "";

        const infoEmbed =
            new EmbedBuilder()
                .setTitle(
                    `Testing Session: ${player.ign}`
                )
                .setColor(
                    config.colors.primary
                )
                .addFields(
                    {
                        name: "Discord",
                        value:
                            `<@${member.discord_id}>`,
                        inline: true
                    },
                    {
                        name: "IGN",
                        value:
                            player.ign,
                        inline: true
                    },
                    {
                        name: "Region",
                        value:
                            player.region || "Not set",
                        inline: true
                    },
                    {
                        name: "Account",
                        value:
                            player.account_type || "Not set",
                        inline: true
                    },
                    {
                        name: "Gamemode",
                        value:
                            `${gameEmoji} ${gamemode}`,
                        inline: true
                    },
                    {
                        name: "Current Tier",
                        value:
                            lastResult?.new_tier ||
                            "Unranked",
                        inline: true
                    }
                )
                .setFooter({
                    text:
                        `Tester: ${interaction.user.tag}`
                })
                .setTimestamp();

        // =====================================================
        // SEND TICKET PANEL
        // =====================================================

        await ticketChannel.send({
            content:
                `<@${member.discord_id}>, your test is ready!`,
            embeds: [infoEmbed]
        });

        // =====================================================
        // TICKET READY DM
        // =====================================================

        try {

            const playerUser =
                await interaction.client.users.fetch(
                    member.discord_id
                );

            const ticketDM =
                new EmbedBuilder()
                    .setColor(
                        config.colors.primary
                    )
                    .setTitle(
                        "🎫 Your Testing Ticket Is Ready"
                    )
                    .setDescription(
                        `Your **${gamemode}** testing ticket has been opened.\n\n` +
                        `Please be ready and head to ${ticketChannel}.`
                    )
                    .addFields(
                        {
                            name: "Gamemode",
                            value:
                                `${gameEmoji} ${gamemode}`,
                            inline: true
                        },
                        {
                            name: "IGN",
                            value:
                                player.ign,
                            inline: true
                        }
                    )
                    .setFooter({
                        text:
                            "AsianTiers • Testing Session"
                    })
                    .setTimestamp();

            await playerUser.send({
                embeds: [ticketDM]
            });

        } catch (dmError) {

            console.error(
                `TICKET DM FAILED [${member.discord_id}]:`,
                dmError.message
            );
        }

        // =====================================================
        // FINISH
        // =====================================================

        await interaction.editReply({
            content:
                `<:tick:1567480091267825714> Ticket created: ${ticketChannel}`
        });
    }
};