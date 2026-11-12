const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
    EmbedBuilder,
    ChannelType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js');

const config = require('../config/config');
const supabase = require('../database/supabase');
const queueRenderer = require('../queue/queueRenderer');
const perms = require('../utils/permissions');

module.exports = {
    name: 'interactionCreate',

    async execute(interaction) {

        try {

            // =====================================================
            // SLASH COMMANDS
            // =====================================================

            if (interaction.isChatInputCommand()) {

                const command =
                    interaction.client.commands.get(
                        interaction.commandName
                    );

                if (!command) return;

                try {

                    await command.execute(
                        interaction
                    );

                } catch (error) {

                    console.error(
                        `COMMAND ERROR [${interaction.commandName}]:`,
                        error
                    );

                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {

                        await interaction.editReply({
                            content:
                                '<:crosss:1570104768628531290> An error occurred while executing this command.'
                        }).catch(() => {});

                    } else {

                        await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> An error occurred while executing this command.',
                            flags:
                                MessageFlags.Ephemeral
                        }).catch(() => {});
                    }
                }

                return;
            }

            // =====================================================
            // BUTTONS
            // =====================================================

            if (interaction.isButton()) {

                const customId =
                    interaction.customId;

                // =================================================
                // TESTER LEADERBOARD RESET
                // =================================================

                if (
                    customId ===
                    'tester_leaderboard_reset'
                ) {

                    if (
                        interaction.user.id !==
                        config.roles.ownerId
                    ) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Only the bot owner can reset the tester leaderboard.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    try {

                        const { error } =
                            await supabase
                                .from('results')
                                .delete()
                                .not(
                                    'id',
                                    'is',
                                    null
                                );

                        if (error) {

                            console.error(
                                'TESTER LEADERBOARD RESET ERROR:',
                                error
                            );

                            return await interaction.reply({
                                content:
                                    '<:crosss:1570104768628531290> Failed to reset the tester leaderboard.',
                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        return await interaction.reply({
                            content:
                                '<:tick:1570104808055111742> Tester leaderboard has been reset successfully.',
                            flags:
                                MessageFlags.Ephemeral
                        });

                    } catch (error) {

                        console.error(
                            'LEADERBOARD RESET ERROR:',
                            error
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Something went wrong while resetting the leaderboard.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }
                }

                // =================================================
                // HIGH TEST GAMEMODE BUTTON
                // =================================================

                if (
                    customId.startsWith(
                        'high_test_'
                    )
                ) {

                    const highGamemode =
                        customId.replace(
                            'high_test_',
                            ''
                        );

                    // =============================================
                    // 15 DAY COOLDOWN CHECK
                    // =============================================

                    const {
                        data: highCooldown,
                        error: cooldownError
                    } = await supabase
                        .from('testing_cooldowns')
                        .select(
                            'cooldown_until'
                        )
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            'HighTest'
                        )
                        .maybeSingle();

                    if (cooldownError) {

                        console.error(
                            'HIGH TEST COOLDOWN CHECK ERROR:',
                            cooldownError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Could not check your High Test cooldown.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        highCooldown &&
                        new Date(
                            highCooldown.cooldown_until
                        ) > new Date()
                    ) {

                        const unix =
                            Math.floor(
                                new Date(
                                    highCooldown.cooldown_until
                                ).getTime() / 1000
                            );

                        return await interaction.reply({
                            content:
                                `⏳ You are on a **High Test cooldown**.\n\n` +
                                `You can open another High Test ticket <t:${unix}:R>.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // PLAYER PROFILE
                    // =============================================

                    const {
                        data: player,
                        error: playerError
                    } = await supabase
                        .from('players')
                        .select('*')
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .maybeSingle();

                    if (playerError) {

                        console.error(
                            'HIGH TEST PLAYER ERROR:',
                            playerError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Database error while checking your profile.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (!player) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> You are not registered.\n\nPlease register your UniversalTiers profile first.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

    // =============================================
    // CHECK HIGH TEST ALLOWLIST
    // Owners can manually allow players with /add.
    // =============================================

    const { data: allowlistedPlayer, error: allowlistError } = await supabase
        .from('high_test_players')
        .select('discord_id')
        .eq('discord_id', interaction.user.id)
        .maybeSingle();

    if (allowlistError) {
        console.error('HIGH TEST ALLOWLIST CHECK ERROR:', JSON.stringify(allowlistError, null, 2));
        return await interaction.reply({
            content: '<:crosss:1570104768628531290> Database error while checking High Test access.',
            flags: MessageFlags.Ephemeral
        });
    }

    const isAllowlisted = Boolean(allowlistedPlayer);

    // =============================================
    // CHECK LT3 OR HIGHER UNLESS ALLOWLISTED
    // GET LATEST TIER FROM RESULTS TABLE
    // =============================================

    const {
        data: latestResult,
        error: tierError
    } = await supabase
        .from('results')
        .select('new_tier, created_at')
        .eq(
            'discord_id',
            interaction.user.id
        )
        .eq(
            'gamemode',
            highGamemode
        )
        .order(
            'created_at',
            {
                ascending: false
            }
        )
        .limit(1)
        .maybeSingle();

    if (tierError) {

        console.error(
            'HIGH TEST TIER CHECK ERROR:',
            tierError
        );

        return await interaction.reply({
            content:
                '<:crosss:1570104768628531290> Database error while checking your current tier.',
            flags:
                MessageFlags.Ephemeral
        });
    }

    const currentTier =
        latestResult?.new_tier ||
        'Unranked';

    // LT3 or higher
    const eligibleTiers = [
        'LT3',
        'HT3'
    ];

    if (
        !isAllowlisted &&
        !eligibleTiers.includes(currentTier)
    ) {

        return await interaction.reply({
            content:
                `<:crosss:1570104768628531290> You need **LT3 or higher** in **${highGamemode}** to apply for a High Test.\n\n` +
                `Your current **${highGamemode}** tier is **${currentTier}**.`,
            flags:
                MessageFlags.Ephemeral
        });
    }

    console.log(
        `<:tick:1570104808055111742> High Test eligibility: ${interaction.user.tag} | ${highGamemode} | ${currentTier}`
    );

                        // =============================================
                        // OPEN QUESTIONS MODAL
                        // =============================================

                        const modal =
                            new ModalBuilder()
                                .setCustomId(
                                    `high_test_modal_${highGamemode}`
                                )
                                .setTitle(
                                    `${highGamemode} High Test`
                                );

                        const currentTierInput =
                            new TextInputBuilder()
                                .setCustomId(
                                    'current_tier'
                                )
                                .setLabel(
                                    'Current Tier'
                                )
                                .setPlaceholder(
                                    'Example: LT3'
                                )
                                .setStyle(
                                    TextInputStyle.Short
                                )
                                .setRequired(true)
                                .setMaxLength(20);

                        const regionInput =
                            new TextInputBuilder()
                                .setCustomId(
                                    'region'
                                )
                                .setLabel(
                                    'Region'
                                )
                                .setPlaceholder(
                                    'EU, NA, AS, AU, ME'
                                )
                                .setStyle(
                                    TextInputStyle.Short
                                )
                                .setRequired(true)
                                .setMaxLength(20);

                        const serverInput =
                            new TextInputBuilder()
                                .setCustomId(
                                    'preferred_server'
                                )
                                .setLabel(
                                    'Preferred Server'
                                )
                                .setPlaceholder(
                                    'Example: Minemen Club'
                                )
                                .setStyle(
                                    TextInputStyle.Short
                                )
                                .setRequired(true)
                                .setMaxLength(50);

                        modal.addComponents(
                            new ActionRowBuilder()
                                .addComponents(
                                    currentTierInput
                                ),

                            new ActionRowBuilder()
                                .addComponents(
                                    regionInput
                                ),

                            new ActionRowBuilder()
                                .addComponents(
                                    serverInput
                                )
                        );

                        return await interaction.showModal(
                            modal
                        );
                    }

                    // =================================================
                    // HIGH TEST CLOSE / SKIP
                    // =================================================

                    if (
                        customId === 'high_ticket_close' ||
                        customId === 'high_ticket_skip'
                    ) {
                        const isSkip = customId === 'high_ticket_skip';
                        const isOwner = interaction.user.id === config.roles.ownerId;

                        const { data: staffRoles, error: staffRolesError } = await supabase
                            .from('high_test_staff_roles')
                            .select('role_id');

    
    if (staffRolesError) {
        console.error(
            'HIGH TEST STAFF CHECK ERROR:',
            JSON.stringify(staffRolesError, null, 2)
        );

        return await interaction.reply({
            content: '<:crosss:1570104768628531290> Could not verify High Test staff permissions. Check bot logs.',
            flags: MessageFlags.Ephemeral
        });
    }

    const staffRoleIds = (staffRoles || [])
        .map(row => String(row.role_id));

    // Owner bypasses the staff-role list.
    // All other users must have a role explicitly added via /addrole.

    const HIGH_TEST_STAFF_ROLE_ID = '1542798698617249842';

    const memberRoleIds = interaction.member?.roles?.cache
        ? [...interaction.member.roles.cache.keys()]
        : [];

    const isHighTestStaff = memberRoleIds.includes(
        HIGH_TEST_STAFF_ROLE_ID
    );

    if (!isOwner && !isHighTestStaff) {
        return await interaction.reply({
            content: '<:crosss:1570104768628531290> Only High Test staff can close or skip this ticket.',
            flags: MessageFlags.Ephemeral
        });
    }

                        // =============================================
                        // GET TICKET OWNER
                        // =============================================

                        const topic =
                            interaction.channel.topic ||
                            '';

                        const userMatch =
                            topic.match(
                                /HT_USER:(\d+)/
                            );

                        const gamemodeMatch =
                            topic.match(
                                /GAMEMODE:([A-Za-z]+)/
                            );

                        if (!userMatch) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Could not identify the ticket owner.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const ticketUserId =
                        userMatch[1];

                    const ticketGamemode =
                        gamemodeMatch
                            ? gamemodeMatch[1]
                            : 'Unknown';

                    // =============================================
                    // DEFER
                    // =============================================

                    await interaction.deferReply({
                        flags:
                            MessageFlags.Ephemeral
                    });

                    // =============================================
                    // GET ALL MESSAGES
                    // =============================================

                    const allMessages = [];

                    let lastId = null;

                    while (true) {

                        const options = {
                            limit: 100
                        };

                        if (lastId) {
                            options.before =
                                lastId;
                        }

                        const messages =
                            await interaction.channel
                                .messages
                                .fetch(options);

                        if (
                            messages.size === 0
                        ) {
                            break;
                        }

                        allMessages.push(
                            ...messages.values()
                        );

                        lastId =
                            messages.last().id;

                        if (
                            messages.size < 100
                        ) {
                            break;
                        }
                    }

                    // =============================================
                    // SORT OLD → NEW
                    // =============================================

                    allMessages.sort(
                        (a, b) =>
                            a.createdTimestamp -
                            b.createdTimestamp
                    );

                    // =============================================
                    // CREATE TRANSCRIPT
                    // =============================================

                    let transcript =
                        '';

                    transcript +=
                        'UniversalTiers High Test Transcript\n';

                    transcript +=
                        '========================================\n\n';

                    transcript +=
                        `Ticket: ${interaction.channel.name}\n`;

                    transcript +=
                        `Gamemode: ${ticketGamemode}\n`;

                    transcript +=
                        `Ticket ID: ${interaction.channel.id}\n`;

                    transcript +=
                        `Player ID: ${ticketUserId}\n`;

                    transcript +=
                        `${isSkip ? 'Skipped By' : 'Closed By'}: ${interaction.user.tag} (${interaction.user.id})\n`;

                    transcript +=
                        `Closed At: ${new Date().toISOString()}\n\n`;

                    transcript +=
                        '========================================\n\n';

                    for (
                        const message
                        of allMessages
                    ) {

                        const date =
                            new Date(
                                message.createdTimestamp
                            ).toISOString();

                        let content =
                            message.content ||
                            '';

                        if (
                            message.attachments.size > 0
                        ) {

                            const attachments =
                                message.attachments
                                    .map(
                                        attachment =>
                                            attachment.url
                                    )
                                    .join('\n');

                            content +=
                                `\n[Attachments]\n${attachments}`;
                        }

                        if (
                            message.embeds.length > 0
                        ) {

                            for (
                                const embed
                                of message.embeds
                            ) {

                                if (
                                    embed.title
                                ) {
                                    content +=
                                        `\n[Embed Title] ${embed.title}`;
                                }

                                if (
                                    embed.description
                                ) {
                                    content +=
                                        `\n[Embed Description] ${embed.description}`;
                                }
                            }
                        }

                        transcript +=
                            `[${date}] ${message.author.tag} (${message.author.id})\n`;

                        transcript +=
                            `${content || '[No text content]'}\n\n`;
                    }

                    // =============================================
                    // TRANSCRIPT CHANNEL
                    // =============================================

                    const transcriptChannel =
                        await interaction.guild.channels.fetch(
                            config.channels.transcriptChannel ||
                            '1567481439816253522'
                        );

                    if (!transcriptChannel) {

                        console.error(
                            'TRANSCRIPT CHANNEL NOT FOUND'
                        );

                        return await interaction.editReply({
                            content:
                                '<:crosss:1570104768628531290> Transcript channel could not be found. Ticket was NOT closed.'
                        });
                    }

                    // =============================================
                    // SEND TRANSCRIPT
                    // =============================================

                    const transcriptFile =
                        new AttachmentBuilder(
                            Buffer.from(
                                transcript,
                                'utf8'
                            ),
                            {
                                name:
                                    `${interaction.channel.name}-transcript.txt`
                            }
                        );

                    const transcriptEmbed =
                        new EmbedBuilder()
                            .setColor(
                                config.colors.primary
                            )
                            .setTitle(
                                '📄 High Test Transcript'
                            )
                            .addFields(
                                {
                                    name:
                                        'Player',
                                    value:
                                        `<@${ticketUserId}>`,
                                    inline: true
                                },

                                {
                                    name:
                                        'Gamemode',
                                    value:
                                        `**${ticketGamemode}**`,
                                    inline: true
                                },

                                {
                                    name:
                                        isSkip ? 'Skipped By' : 'Closed By',
                                    value:
                                        `<@${interaction.user.id}>`,
                                    inline: true
                                },

                                {
                                    name:
                                        'Ticket',
                                    value:
                                        `\`${interaction.channel.name}\``,
                                    inline: true
                                }
                            )
                            .setTimestamp();

                    await transcriptChannel.send({
                        embeds: [
                            transcriptEmbed
                        ],
                        files: [
                            transcriptFile
                        ]
                    });

                    // =============================================
                    // 15 DAY COOLDOWN (CLOSE ONLY; SKIP HAS NO COOLDOWN)
                    // =============================================

                    if (!isSkip) {
                    const cooldownUntil =
                        new Date(
                            Date.now() +
                            15 *
                            24 *
                            60 *
                            60 *
                            1000
                        );

                    const {
                        error: cooldownSaveError
                    } = await supabase
                        .from(
                            'testing_cooldowns'
                        )
                        .upsert(
                            {
                                discord_id:
                                    ticketUserId,

                                gamemode:
                                    'HighTest',

                                cooldown_until:
                                    cooldownUntil.toISOString()
                            },
                            {
                                onConflict:
                                    'discord_id,gamemode'
                            }
                        );

                    if (cooldownSaveError) {

                        console.error(
                            'HIGH TEST COOLDOWN SAVE ERROR:',
                            cooldownSaveError
                        );

                        return await interaction.editReply({
                            content:
                                '⚠️ Transcript was saved, but the 15-day cooldown could not be saved. Ticket was NOT deleted.'
                        });
                    }

                    }

                    // =============================================
                    // SUCCESS MESSAGE
                    // =============================================

                    await interaction.editReply({
                        content: isSkip
                            ? '⏭️ Transcript saved successfully. Closing ticket without a cooldown.'
                            : '<:tick:1570104808055111742> Transcript saved successfully.\n<:close:1570105019326275604> 15-day High Test cooldown applied.\n🗑️ Closing ticket...'
                    });

                    // =============================================
                    // DELETE TICKET AFTER TRANSCRIPT
                    // =============================================

                    setTimeout(
                        async () => {

                            try {

                                await interaction.channel.delete(
                                    isSkip ? 'High Test ticket skipped' : 'High Test ticket closed'
                                );

                            } catch (error) {

                                console.error(
                                    'HIGH TEST TICKET DELETE ERROR:',
                                    error
                                );
                            }

                        },
                        2500
                    );

                    return;
                }

                // =================================================
                // REGISTRATION BUTTON
                // =================================================

                if (
                    customId ===
                    'register_profile'
                ) {

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                'registration_modal'
                            )
                            .setTitle(
                                'Profile Registration'
                            );

                    const ignInput =
                        new TextInputBuilder()
                            .setCustomId(
                                'ign'
                            )
                            .setLabel(
                                'Minecraft IGN'
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true);

                    const regionInput =
                        new TextInputBuilder()
                            .setCustomId(
                                'region'
                            )
                            .setLabel(
                                'Region (e.g. EU, NA, AS)'
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true);

                    const accInput =
                        new TextInputBuilder()
                            .setCustomId(
                                'acc_type'
                            )
                            .setLabel(
                                'Account Type (Premium/Cracked)'
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(
                                ignInput
                            ),

                        new ActionRowBuilder()
                            .addComponents(
                                regionInput
                            ),

                        new ActionRowBuilder()
                            .addComponents(
                                accInput
                            )
                    );

                    return await interaction.showModal(
                        modal
                    );
                }

                // =================================================
                // WAITLIST BUTTONS
                // =================================================

                if (
                    customId.startsWith(
                        'waitlist_'
                    )
                ) {

                    const gamemodeMap = {

                        waitlist_axe:
                            'Axe',

                        waitlist_sword:
                            'Sword',

                        waitlist_uhc:
                            'UHC',

                        waitlist_smp:
                            'SMP',

                        waitlist_diapot:
                            'DiaPot',

                        waitlist_mace:
                            'Mace',

                        waitlist_crystal:
                            'Crystal',

                        waitlist_nethpot:
                            'NethPot',

                        waitlist_spearmace:
                            'spearmace',

                        waitlist_diasmp:
                            'diasmp',

                        waitlist_manhunt:
                            'manhunt',

                        waitlist_shieldlessuhc:
                            'shieldlessuhc',

                        waitlist_cart:
                            'cart'
                    };

                    const gamemode =
                        gamemodeMap[
                            customId
                        ];

                    if (!gamemode) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Invalid waitlist.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        perms.isBlacklisted(
                            interaction.member
                        )
                    ) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> You cannot join the testing waitlist.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (
                        !perms.isVerified(
                            interaction.member
                        )
                    ) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> **Register your profile first.**\n\nClick **Register / Update Profile** before selecting a waitlist.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const roleId =
                        config.roles.waitlist?.[
                            gamemode
                        ];

                    if (!roleId) {

                        return await interaction.reply({
                            content:
                                `<:crosss:1570104768628531290> Waitlist role for **${gamemode}** is not configured.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const role =
                        interaction.guild.roles.cache.get(
                            roleId
                        );

                    if (!role) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> The waitlist role could not be found.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // Acknowledge early to avoid Discord interaction timeouts.
                    if (!interaction.deferred && !interaction.replied) {
                        await interaction.deferReply({
                            flags: MessageFlags.Ephemeral
                        });
                    }

﻿                    if (
                        interaction.member.roles.cache.has(
                            roleId
                        )
                    ) {

                        try {

                            await interaction.member.roles.remove(
                                roleId,
                                `Left ${gamemode} waitlist`
                            );

                            return await interaction.editReply({
                                content:
                                    `<:tick:1570104808055111742> You left the **${gamemode}** waitlist.`,
                                flags:
                                    MessageFlags.Ephemeral
                            });

                        } catch (error) {

                            console.error(
                                'WAITLIST ROLE REMOVE ERROR:',
                                error
                            );

                            return await interaction.editReply({
                                content:
                                    '<:crosss:1570104768628531290> Could not remove the waitlist role.',
                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }
                    }

                    try {

                        await interaction.member.roles.add(
                            roleId,
                            `Joined ${gamemode} waitlist`
                        );

                        return await interaction.editReply({
                            content:
                                `<:tick:1570104808055111742> You joined the **${gamemode}** waitlist!`,
                            flags:
                                MessageFlags.Ephemeral
                        });

                    } catch (error) {

                        console.error(
                            'WAITLIST ROLE ADD ERROR:',
                            error
                        );

                        return await interaction.editReply({
                            content:
                                '<:crosss:1570104768628531290> I could not give you the waitlist role. Please contact staff.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }
                }

                // =================================================
                // QUEUE BUTTON PARSER
                // =================================================

                const parts =
                    customId.split('_');

                const action =
                    parts[0];

                const gamemode =
                    parts
                        .slice(2)
                        .join('_');

                if (
                    action !== 'join' &&
                    action !== 'leave' &&
                    action !== 'refresh'
                ) {
                    return;
                }

                // =================================================
                // BLACKLIST
                // =================================================

                if (
                    perms.isBlacklisted(
                        interaction.member
                    )
                ) {

                    return await interaction.reply({
                        content:
                            '<:crosss:1570104768628531290> You are blacklisted from joining UniversalTiers testing queues.',
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // VERIFIED
                // =================================================

                if (
                    !perms.isVerified(
                        interaction.member
                    )
                ) {

                    return await interaction.reply({
                        content:
                            '<:crosss:1570104768628531290> **Register your profile first.**',
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // REFRESH QUEUE
                // =================================================

                if (
                    action === 'refresh'
                ) {

                    try {

                        await queueRenderer.updateQueuePanel(
                            interaction.client,
                            gamemode
                        );

                    } catch (error) {

                        console.error(
                            'QUEUE REFRESH ERROR:',
                            error
                        );
                    }

                    return await interaction.reply({
                        content:
                            '🔄 Queue refreshed.',
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // JOIN QUEUE
                // =================================================

                if (
                    action === 'join'
                ) {

                    const {
                        data: cooldown,
                        error: cooldownError
                    } = await supabase
                        .from(
                            'testing_cooldowns'
                        )
                        .select(
                            'cooldown_until'
                        )
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            gamemode
                        )
                        .maybeSingle();

                    if (cooldownError) {

                        console.error(
                            'COOLDOWN CHECK ERROR:',
                            cooldownError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Could not check your testing cooldown. Please contact staff.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (cooldown) {

                        const cooldownUntil =
                            new Date(
                                cooldown.cooldown_until
                            );

                        if (
                            cooldownUntil >
                            new Date()
                        ) {

                            const unix =
                                Math.floor(
                                    cooldownUntil.getTime() /
                                    1000
                                );

                            return await interaction.reply({
                                content:
                                    `⏳ **You are on ${gamemode} testing cooldown.**\n\n` +
                                    `You can test **${gamemode}** again <t:${unix}:R>.`,
                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        await supabase
                            .from(
                                'testing_cooldowns'
                            )
                            .delete()
                            .eq(
                                'discord_id',
                                interaction.user.id
                            )
                            .eq(
                                'gamemode',
                                gamemode
                            );
                    }

                    // =============================================
                    // ALREADY IN ANY QUEUE
                    // =============================================

                    const {
                        data: existingQueue,
                        error: queueCheckError
                    } = await supabase
                        .from(
                            'queue_members'
                        )
                        .select('*')
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .maybeSingle();

                    if (queueCheckError) {

                        console.error(
                            'QUEUE CHECK ERROR:',
                            queueCheckError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Could not check your queue status.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    if (existingQueue) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> You are already in a queue! Leave your current queue first.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // ACTIVE SESSION CHECK
                    // =============================================

                    const {
                        data: activeSessions,
                        error: sessionError
                    } = await supabase
                        .from(
                            'testing_sessions'
                        )
                        .select('*')
                        .eq(
                            'player_discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'status',
                            'ACTIVE'
                        );

                    if (sessionError) {

                        console.error(
                            'SESSION CHECK ERROR:',
                            sessionError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Could not check your testing session.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    let realActiveSession =
                        null;

                    if (
                        activeSessions &&
                        activeSessions.length > 0
                    ) {

                        for (
                            const session
                            of activeSessions
                        ) {

                            let ticketExists =
                                false;

                            if (
                                session.ticket_channel_id
                            ) {

                                try {

                                    const channel =
                                        await interaction
                                            .guild
                                            .channels
                                            .fetch(
                                                session.ticket_channel_id
                                            );

                                    if (channel) {
                                        ticketExists =
                                            true;
                                    }

                                } catch (_) {

                                    ticketExists =
                                        false;
                                }
                            }

                            if (
                                ticketExists
                            ) {

                                realActiveSession =
                                    session;

                                break;
                            }

                            await supabase
                                .from(
                                    'testing_sessions'
                                )
                                .update({
                                    status:
                                        'CLOSED',

                                    closed_at:
                                        new Date()
                                            .toISOString()
                                })
                                .eq(
                                    'id',
                                    session.id
                                )
                                .eq(
                                    'status',
                                    'ACTIVE'
                                );
                        }
                    }

                    if (
                        realActiveSession
                    ) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> You already have an active testing session.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // INSERT QUEUE
                    // =============================================

                    const {
                        data: insertedMember,
                        error: insertError
                    } = await supabase
                        .from(
                            'queue_members'
                        )
                        .insert({
                            gamemode,

                            discord_id:
                                interaction.user.id,

                            priority:
                                perms.hasPriority(
                                    interaction.member
                                )
                        })
                        .select()
                        .single();

                    if (insertError) {

                        console.error(
                            'QUEUE INSERT ERROR:',
                            insertError
                        );

                        if (
                            insertError.code ===
                            '23505'
                        ) {

                            return await interaction.reply({
                                content:
                                    '<:crosss:1570104768628531290> You are already in a queue! Leave your current queue first.',
                                flags:
                                    MessageFlags.Ephemeral
                            });
                        }

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Failed to join the queue. Please try again.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // POSITION
                    // =============================================

                    const {
                        data: currentMembers,
                        error: positionError
                    } = await supabase
                        .from(
                            'queue_members'
                        )
                        .select('*')
                        .eq(
                            'gamemode',
                            gamemode
                        )
                        .order(
                            'priority',
                            {
                                ascending:
                                    false
                            }
                        )
                        .order(
                            'joined_at',
                            {
                                ascending:
                                    true
                            }
                        );

                    if (positionError) {

                        console.error(
                            'QUEUE POSITION ERROR:',
                            positionError
                        );
                    }

                    let position =
                        null;

                    if (
                        currentMembers &&
                        currentMembers.length > 0
                    ) {

                        const index =
                            currentMembers.findIndex(
                                member =>
                                    member.id ===
                                    insertedMember.id
                            );

                        if (
                            index !== -1
                        ) {
                            position =
                                index + 1;
                        }
                    }

                    // =============================================
                    // SUCCESS
                    // =============================================

                    await interaction.reply({
                        content:
                            `<:tick:1570104808055111742> You joined the **${gamemode}** queue.` +
                            (
                                position
                                    ? ` You are currently **#${position}**.`
                                    : ''
                            ),
                        flags:
                            MessageFlags.Ephemeral
                    });

                    // =============================================
                    // POSITION DM
                    // =============================================

                    if (
                        position === 1 ||
                        position === 2
                    ) {

                        try {

                            const dmEmbed =
                                new EmbedBuilder()
                                    .setColor(
                                        config.colors.primary
                                    )
                                    .setTitle(
                                        position === 1
                                            ? '🔔 You are #1'
                                            : '🔔 You are #2'
                                    )
                                    .setDescription(
                                        position === 1
                                            ? `You are currently **#1** in the **${gamemode}** queue.\n\nPlease be ready. Your testing ticket will be opened shortly.`
                                            : `You are currently **#2** in the **${gamemode}** queue.\n\nPlease be ready for your test.`
                                    )
                                    .setFooter({
                                        text:
                                            'UniversalTiers • Testing Queue'
                                    });

                            await interaction.user.send({
                                embeds: [
                                    dmEmbed
                                ]
                            });

                        } catch (dmError) {

                            console.error(
                                `POSITION DM FAILED [${interaction.user.id}]:`,
                                dmError.message
                            );
                        }
                    }

                    // =============================================
                    // UPDATE PANEL
                    // =============================================

                    try {

                        await queueRenderer.updateQueuePanel(
                            interaction.client,
                            gamemode
                        );

                    } catch (error) {

                        console.error(
                            'QUEUE PANEL UPDATE ERROR:',
                            error
                        );
                    }

                    return;
                }

                // =================================================
                // LEAVE QUEUE
                // =================================================

                if (
                    action === 'leave'
                ) {

                    const {
                        data: leavingMember,
                        error: leavingError
                    } = await supabase
                        .from(
                            'queue_members'
                        )
                        .select('*')
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            gamemode
                        )
                        .maybeSingle();

                    if (leavingError) {

                        console.error(
                            'QUEUE LEAVE CHECK ERROR:',
                            leavingError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Failed to check your queue status.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    const {
                        error: deleteError
                    } = await supabase
                        .from(
                            'queue_members'
                        )
                        .delete()
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            gamemode
                        );

                    if (deleteError) {

                        console.error(
                            'QUEUE LEAVE ERROR:',
                            deleteError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Failed to leave the queue.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    await interaction.reply({
                        content:
                            '<:tick:1570104808055111742> You left the queue.',
                        flags:
                            MessageFlags.Ephemeral
                    });

                    // =============================================
                    // UPDATE POSITIONS
                    // =============================================

                    try {

                        const {
                            data: remainingMembers,
                            error: remainingError
                        } = await supabase
                            .from(
                                'queue_members'
                            )
                            .select('*')
                            .eq(
                                'gamemode',
                                gamemode
                            )
                            .order(
                                'priority',
                                {
                                    ascending:
                                        false
                                }
                            )
                            .order(
                                'joined_at',
                                {
                                    ascending:
                                        true
                                }
                            );

                        if (
                            remainingError
                        ) {
                            throw remainingError;
                        }

                        for (
                            let i = 0;
                            i <
                            Math.min(
                                remainingMembers.length,
                                2
                            );
                            i++
                        ) {

                            const member =
                                remainingMembers[i];

                            const newPosition =
                                i + 1;

                            try {

                                const user =
                                    await interaction
                                        .client
                                        .users
                                        .fetch(
                                            member.discord_id
                                        );

                                const dmEmbed =
                                    new EmbedBuilder()
                                        .setColor(
                                            config.colors.primary
                                        )
                                        .setTitle(
                                            newPosition === 1
                                                ? '🔔 You are #1'
                                                : '🔔 You are #2'
                                        )
                                        .setDescription(
                                            newPosition === 1
                                                ? `You are now **#1** in the **${gamemode}** queue.\n\nPlease be ready. Your testing ticket will be opened shortly.`
                                                : `You are now **#2** in the **${gamemode}** queue.\n\nPlease be ready for your test.`
                                        )
                                        .setFooter({
                                            text:
                                                'UniversalTiers • Testing Queue'
                                        });

                                await user.send({
                                    embeds: [
                                        dmEmbed
                                    ]
                                });

                            } catch (dmError) {

                                console.error(
                                    `POSITION DM FAILED [${member.discord_id}]:`,
                                    dmError.message
                                );
                            }
                        }

                    } catch (error) {

                        console.error(
                            'POSITION UPDATE ERROR:',
                            error
                        );
                    }

                    // =============================================
                    // UPDATE PANEL
                    // =============================================

                    try {

                        await queueRenderer.updateQueuePanel(
                            interaction.client,
                            gamemode
                        );

                    } catch (error) {

                        console.error(
                            'QUEUE PANEL UPDATE ERROR:',
                            error
                        );
                    }

                    return;
                }

                return;
            }

            // =====================================================
            // MODALS
            // =====================================================

            if (
                interaction.isModalSubmit()
            ) {

                // =================================================
                // HIGH TEST MODAL
                // =================================================

                if (
                    interaction.customId.startsWith(
                        'high_test_modal_'
                    )
                ) {

                    const highGamemode =
                        interaction.customId.replace(
                            'high_test_modal_',
                            ''
                        );

                    const currentTier =
                        interaction.fields.getTextInputValue(
                            'current_tier'
                        );

                    const region =
                        interaction.fields.getTextInputValue(
                            'region'
                        );

                    const preferredServer =
                        interaction.fields.getTextInputValue(
                            'preferred_server'
                        );

                    // =============================================
                    // COOLDOWN CHECK AGAIN
                    // =============================================

                    const {
                        data: cooldown
                    } = await supabase
                        .from(
                            'testing_cooldowns'
                        )
                        .select(
                            'cooldown_until'
                        )
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            'HighTest'
                        )
                        .maybeSingle();

                    if (
                        cooldown &&
                        new Date(
                            cooldown.cooldown_until
                        ) > new Date()
                    ) {

                        const unix =
                            Math.floor(
                                new Date(
                                    cooldown.cooldown_until
                                ).getTime() /
                                1000
                            );

                        return await interaction.reply({
                            content:
                                `⏳ You are already on a High Test cooldown.\n\nYou can apply again <t:${unix}:R>.`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // PLAYER
                    // =============================================

                    const {
                        data: player,
                        error: playerError
                    } = await supabase
                        .from(
                            'players'
                        )
                        .select('*')
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .maybeSingle();

                    if (
                        playerError ||
                        !player
                    ) {

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Player profile not found.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // CHECK FOR EXISTING OPEN HT TICKET
                    // =============================================

                    const existingTicket =
                        interaction.guild.channels.cache.find(
                            channel =>
                                channel.parentId ===
                                    '1570452104458276955' &&
                                channel.topic?.includes(
                                    `HT_USER:${interaction.user.id}`
                                )
                        );

                    if (
                        existingTicket
                    ) {

                        return await interaction.reply({
                            content:
                                `<:crosss:1570104768628531290> You already have an open High Test ticket: ${existingTicket}`,
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // CREATE TICKET
                    // =============================================

                    const categoryId =
                        '1570452104458276955';

                    const safeName =
                        player.ign
                            .toLowerCase()
                            .replace(
                                /[^a-z0-9]/g,
                                ''
                            )
                            .slice(
                                0,
                                18
                            ) ||
                        'player';

                    const { data: staffRoles, error: staffRolesError } = await supabase
                        .from('high_test_staff_roles')
                        .select('role_id');

                    if (staffRolesError) {
                        console.error('HIGH TEST STAFF ROLES ERROR:', staffRolesError);
                        return await interaction.reply({
                            content: '<:crosss:1570104768628531290> Could not load High Test staff roles.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const staffRoleIds = (staffRoles || []).map(row => row.role_id);

                    const permissionOverwrites = [
                        {
                            id: interaction.guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.AttachFiles
                            ]
                        },
                        {
                            id: config.roles.ownerId,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.AttachFiles
                            ]
                        },
                        {
                            id: interaction.client.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.AttachFiles
                            ]
                        },
                        ...staffRoleIds.map(roleId => ({
                            id: roleId,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.AttachFiles
                            ]
                        }))
                    ];

                    const ticketChannel =
                        await interaction.guild.channels.create({
                            name:
                                `ht-${safeName}`,

                            type:
                                ChannelType.GuildText,

                            parent:
                                categoryId,

                            topic:
                                `HT_USER:${interaction.user.id} | GAMEMODE:${highGamemode}`,

                            permissionOverwrites

                        });

                    // =============================================
                    // TICKET EMBED
                    // =============================================

                    const gameEmoji =
                        require('../config/emojis')
                            .gamemodes?.[
                                highGamemode
                            ] || '';

                    const displayName =
                        config.gamemodeNames?.[highGamemode] ||
                        highGamemode;

                    const ticketEmbed =
                        new EmbedBuilder()
                            .setColor(
                                config.colors.primary
                            )
                            .setTitle(
                                `${gameEmoji} ${displayName} — High Test Ticket`
                            )
                            .setDescription(
                                `Welcome ${interaction.user}!\n\n` +
                                `Your **High Test** application has been created.\n` +
                                `A tester will review your application shortly.`
                            )
                            .addFields(

                                {
                                    name:
                                        '👤 Player',
                                    value:
                                        `${interaction.user}\n\`${player.ign}\``,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        '🎮 Gamemode',
                                    value:
                                        `${gameEmoji} **${displayName}**`,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        '🏆 Current Tier',
                                    value:
                                        `\`${currentTier}\``,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        '🌍 Region',
                                    value:
                                        `\`${region}\``,
                                    inline:
                                        true
                                },

                                {
                                    name:
                                        '🖥️ Preferred Server',
                                    value:
                                        `\`${preferredServer}\``,
                                    inline:
                                        true
                                }
                            )
                            .setFooter({
                                text:
                                    'UniversalTiers • High Tests'
                            })
                            .setTimestamp();

                    const ticketButtons =
                        new ActionRowBuilder()
                            .addComponents(

                                new ButtonBuilder()
                                    .setCustomId(
                                        'high_ticket_close'
                                    )
                                    .setLabel(
                                        'Close'
                                    )
                                    .setStyle(
                                        ButtonStyle.Danger
                                    ),

                                new ButtonBuilder()
                                    .setCustomId(
                                        'high_ticket_skip'
                                    )
                                    .setLabel(
                                        'Skip'
                                    )
                                    .setStyle(
                                        ButtonStyle.Secondary
                                    )
                            );

                    await ticketChannel.send({
                        content: [
                            `<@${interaction.user.id}>`,
                            ...staffRoleIds.map(roleId => `<@&${roleId}>`)
                        ].join(' '),

                        embeds: [
                            ticketEmbed
                        ],

                        components: [
                            ticketButtons
                        ]
                    });

                    // =============================================
                    // SUCCESS
                    // =============================================

                    return await interaction.reply({
                        content:
                            `<:tick:1570104808055111742> Your **${config.gamemodeNames?.[highGamemode] || highGamemode} High Test** ticket has been created: ${ticketChannel}`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // REGISTRATION MODAL
                // =================================================

                if (
                    interaction.customId ===
                    'registration_modal'
                ) {

                    const ign =
                        interaction.fields.getTextInputValue(
                            'ign'
                        );

                    const region =
                        interaction.fields.getTextInputValue(
                            'region'
                        );

                    const accType =
                        interaction.fields.getTextInputValue(
                            'acc_type'
                        );

                    const {
                        error: profileError
                    } = await supabase
                        .from(
                            'players'
                        )
                        .upsert(
                            {
                                discord_id:
                                    interaction.user.id,

                                ign,

                                region,

                                account_type:
                                    accType,

                                verified:
                                    true,

                                updated_at:
                                    new Date()
                            },
                            {
                                onConflict:
                                    'discord_id'
                            }
                        );

                    if (
                        profileError
                    ) {

                        console.error(
                            'PROFILE SAVE ERROR:',
                            profileError
                        );

                        return await interaction.reply({
                            content:
                                '<:crosss:1570104768628531290> Failed to save your profile.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    try {

                        await interaction.member.roles.add(
                            config.roles.verified
                        );

                    } catch (error) {

                        console.error(
                            'VERIFIED ROLE ERROR:',
                            error
                        );
                    }

                    return await interaction.reply({
                        content:
                            `<:tick:1570104808055111742> Profile updated for **${ign}**.\nYou can now join testing queues.`,
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                return;
            }

        } catch (error) {

            console.error(
                'INTERACTION CREATE ERROR:',
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.editReply({
                    content:
                        '<:crosss:1570104768628531290> Something went wrong. Please try again.'
                }).catch(() => {});

                return;
            }

            await interaction.reply({
                content:
                    '<:crosss:1570104768628531290> Something went wrong. Please try again.',
                flags:
                    MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
};