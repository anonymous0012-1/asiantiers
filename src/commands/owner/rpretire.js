const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');
const emojis = require('../../config/emojis');
const supabase = require('../../database/supabase');
const perms = require('../../utils/permissions');
const fetch = require('node-fetch');
const tierSystem = require('../../utils/tierSystem');
const playerPeak = require('../../utils/playerPeak');
const roleConfig = require('../../utils/roleConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rpretire')
        .setDescription('Submit a retire test result')

        .addUserOption(opt =>
            opt
                .setName('user')
                .setDescription('The player')
                .setRequired(true)
        )

        .addStringOption(opt =>
            opt
                .setName('tier')
                .setDescription('New Tier')
                .setRequired(true)
                .addChoices(
                    { name: 'RLT2', value: 'RLT2' },
                    { name: 'RHT2', value: 'RHT2' },
                    { name: 'RLT1', value: 'RLT1' },
                    { name: 'RHT1', value: 'RHT1' }
                )
        )

        .addStringOption(opt =>
            opt
                .setName('gamemode')
                .setDescription('Gamemode')
                .setRequired(true)
                .addChoices(
                    { name: 'Sword', value: 'Sword' },
                    { name: 'Mace', value: 'Mace' },
                    { name: 'Axe', value: 'Axe' },
                    { name: 'DiaPot', value: 'DiaPot' },
                    { name: 'SMP', value: 'SMP' },
                    { name: 'UHC', value: 'UHC' },
                    { name: 'SpearMace', value: 'spearmace' },
                    { name: 'Diamond SMP', value: 'diasmp' },
                    { name: 'Manhunt', value: 'manhunt' },
                    { name: 'ShieldLess UHC', value: 'shieldlessuhc' },
                    { name: 'Cart', value: 'cart' }
                )
        ),

    async execute(interaction) {

        // =====================================================
        // TESTER CHECK
        // =====================================================

        const RPRETIRE_ROLE_ID = roleConfig.getRoleIdSync('retire_result_manager') || '1570451892583145583';

        const hasRole = interaction.member.roles.cache.has(RPRETIRE_ROLE_ID);
        console.log('[AuthDebug] rpretire', {
            requiredKey: 'retire_result_manager',
            requiredRoleId: RPRETIRE_ROLE_ID,
            userRoleIds: [...interaction.member.roles.cache.keys()],
            allowed: hasRole
        });
        if (!hasRole) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> Unauthorized.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {

            const user =
                interaction.options.getUser('user');

            const tier =
                interaction.options.getString('tier');

            const gamemode =
                interaction.options.getString('gamemode');

            // =====================================================
            // PLAYER PROFILE
            // =====================================================

            const {
                data: player,
                error: playerError
            } = await supabase
                .from('players')
                .select('*')
                .eq('discord_id', user.id)
                .maybeSingle();

            if (playerError) {

                console.error(
                    '<:crosss:1570104768628531290> PLAYER LOOKUP ERROR:',
                    playerError
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1570104768628531290> Database error while finding the player.'
                });
            }

            if (!player) {

                return interaction.editReply({
                    content:
                        '<:crosss:1570104768628531290> Player profile not found.'
                });
            }

            // =====================================================
            // PREVIOUS TIER
            // GET FROM RESULTS TABLE
            // =====================================================

            const {
                data: previousResult,
                error: previousError
            } = await supabase
                .from('results')
                .select('new_tier')
                .eq('discord_id', user.id)
                .eq('gamemode', gamemode)
                .order('created_at', {
                    ascending: false
                })
                .limit(1)
                .maybeSingle();

            if (previousError) {

                console.error(
                    '<:crosss:1570104768628531290> PREVIOUS TIER LOOKUP ERROR:',
                    previousError
                );
            }

            const previousTier =
                previousResult?.new_tier || 'Unranked';

            // =====================================================
            // PEAK TIER (retirement uses Peak Tier, not current)
            // =====================================================

            const existingPeakTiers = await playerPeak.getPeakTiers(user.id);
            let peakTier = existingPeakTiers?.[gamemode]
                ? tierSystem.normalizeTier(existingPeakTiers[gamemode])
                : null;

            if (!peakTier && tierSystem.isActiveTier(previousTier)) {
                peakTier = tierSystem.normalizeTier(previousTier);
            }

            // If still missing, try to infer from the supplied retired tier.
            if (!peakTier && tier) {
                const base = tierSystem.normalizeTier(tier).replace(/^R/, '');
                if (tierSystem.isActiveTier(base)) {
                    peakTier = base;
                }
            }

            // Initialize peak safely if needed.
            if (!peakTier) {
                peakTier = tierSystem.initializePeak(previousTier, null);
            }

            // /rpretire only supports these four retired tiers.
            const retiredTier = tierSystem.normalizeTier(tier);
            const retiredPoints = tierSystem.getTierPoints(retiredTier);

            // Persist peak (never lower).
            if (peakTier) {
                await playerPeak.setPeakTier(user.id, gamemode, peakTier);
            }

            // =====================================================
            // TIER ROLE CONFIG
            // =====================================================

            // Existing tiers are now stored in Supabase.
            const gamemodeTiers = {};

            // Existing tiers are stored in config. New tiers are stored in Supabase.
            let newRoleId = roleConfig.getRoleIdSync(`tier_${gamemode}_${retiredTier}`);

            if (!newRoleId) {
                try {
                    const { data: tierRoleRow, error: tierRoleError } = await supabase
                        .from('tier_roles')
                        .select('role_id')
                        .eq('gamemode', gamemode)
                        .eq('tier', retiredTier)
                        .maybeSingle();

                    if (tierRoleError) throw tierRoleError;
                    newRoleId = tierRoleRow?.role_id || null;
                } catch (error) {
                    console.error('RP TIER ROLE LOOKUP ERROR:', error);

                    return interaction.editReply({
                        content:
                            `<:crosss:1570104768628531290> Failed to read the tier role mapping for **${tier} ${gamemode}**.`
                    });
                }
            }

            if (!newRoleId) {
                return interaction.editReply({
                    content:
                        `<:crosss:1570104768628531290> Role for **${tier} ${gamemode}** is not configured. Run \`/setuptierroles\` for the new tiers.`
                });
            }

            // =====================================================
            // FETCH MEMBER
            // =====================================================

            const member =
                await interaction.guild.members.fetch(
                    user.id
                );

            // =====================================================
            // REMOVE OLD TIER ROLES
            // =====================================================

            // Collect every tier role for this gamemode from both config and Supabase.
            let allGamemodeRoles = roleConfig.getTierRoleIdsSync(gamemode);

            try {
                const { data: dbGamemodeRoles, error: dbGamemodeRolesError } = await supabase
                    .from('tier_roles')
                    .select('role_id')
                    .eq('gamemode', gamemode);

                if (dbGamemodeRolesError) throw dbGamemodeRolesError;

                allGamemodeRoles = allGamemodeRoles.concat(
                    (dbGamemodeRoles || []).map(row => row.role_id).filter(Boolean)
                );
            } catch (error) {
                console.error('RP GAMEMODE ROLE LOOKUP ERROR:', error);
            }

            allGamemodeRoles = [...new Set(allGamemodeRoles)];

            const rolesUserHas =
                allGamemodeRoles.filter(roleId =>
                    member.roles.cache.has(roleId)
                );

            if (rolesUserHas.length > 0) {

                await member.roles.remove(
                    rolesUserHas,
                    'Updating UniversalTiers tier'
                );
            }

            // =====================================================
            // ADD NEW TIER ROLE
            // =====================================================

            await member.roles.add(
                newRoleId,
                'UniversalTiers test result'
            );

            // =====================================================
            // SAVE RESULT
            // =====================================================

            const {
                error: insertError
            } = await supabase
                .from('results')
                .insert({
                    discord_id: user.id,
                    ign: player.ign,
                    gamemode: gamemode,
                    previous_tier: previousTier,
                    new_tier: retiredTier,
                    tester_id: interaction.user.id
                });

            if (insertError) {

                console.error(
                    '<:crosss:1570104768628531290> RESULT INSERT ERROR:',
                    insertError
                );

                return interaction.editReply({
                    content:
                        ' Discord role was updated, but the result could not be saved.'
                });
            }

            console.log(
                `<:tick:1570104808055111742> Result saved: ${player.ign} | ${gamemode} | ${previousTier}  ${tier}`
            );

            // =====================================================
            // 7 DAY COOLDOWN
            // ONLY THIS GAMEMODE
            // =====================================================

            const cooldownUntil =
                new Date(
                    Date.now() +
                    7 * 24 * 60 * 60 * 1000
                );

            const {
                error: cooldownError
            } = await supabase
                .from('testing_cooldowns')
                .upsert(
                    {
                        discord_id: user.id,
                        gamemode: gamemode,
                        cooldown_until:
                            cooldownUntil.toISOString()
                    },
                    {
                        onConflict:
                            'discord_id,gamemode'
                    }
                );

            if (cooldownError) {

                console.error(
                    '<:crosss:1570104768628531290> COOLDOWN SAVE ERROR:',
                    cooldownError
                );

                return interaction.editReply({
                    content:
                        ' Result was saved, but the 7-day cooldown could not be saved.'
                });
            }

            console.log(
                `<:tick:1570104808055111742> ${user.tag} received a 7-day ${gamemode} cooldown.`
            );

            // =====================================================
            // RETIREMENT DATA (DB)
            // =====================================================

            await playerPeak.setRetiredTier(user.id, gamemode, retiredTier, retiredPoints);

            // =====================================================
            // WEBSITE SYNC
            // =====================================================

            try {

                const websiteResponse =
                    await fetch(
                        process.env.WEBSITE_API_URL,
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json',

                                'X-Bot-Secret':
                                    process.env.WEBSITE_BOT_SECRET
                            },

                            body: JSON.stringify({
                                discordId: user.id,
                                userId: user.id,
                                ign: player.ign,
                                tier: retiredTier,
                                currentTier: retiredTier,
                                peakTier: peakTier,
                                points: retiredPoints,
                                currentTierPoints: retiredPoints,
                                retired: true,
                                retirementStatus: true,
                                retiredTier: retiredTier,
                                retiredPoints: retiredPoints,
                                gamemode:
                                    gamemode.toLowerCase()
                            })
                        }
                    );

                const websiteText =
                    await websiteResponse.text();

                console.log(
                    ' Website API Status:',
                    websiteResponse.status
                );

                console.log(
                    ' Website API Response:',
                    websiteText
                );

                if (!websiteResponse.ok) {

                    console.error(
                        '<:crosss:1570104768628531290> Website sync failed!'
                    );

                } else {

                    console.log(
                        '<:tick:1570104808055111742> Website tier synced successfully!'
                    );
                }

            } catch (error) {

                console.error(
                    '<:crosss:1570104768628531290> WEBSITE SYNC ERROR:',
                    error
                );
            }

            // =====================================================
            // RESULT CHANNEL
            // =====================================================

            const resultChannel =
                await interaction.guild.channels.fetch(
                    config.channels.results
                );

            if (resultChannel) {

                const gameEmoji =
                    emojis.gamemodes?.[gamemode] || '';

            const displayName =
                    config.gamemodeNames?.[gamemode] || gamemode;

                const testerEmoji =
                    emojis.tester ||
                    emojis.ui?.tester ||
                    '';

                const resultEmbed = {

                    title:
                        `${player.ign}'s Tier Update `,

                    color:
                        0x8B0000,

                    fields: [

                        {
                            name:
                                'Tester',

                            value:
                                `${testerEmoji} <@${interaction.user.id}>`,

                            inline:
                                false
                        },

                        {
                            name:
                                'Minecraft Username',

                            value:
                                `\`${player.ign}\``,

                            inline:
                                false
                        },

                        {
                            name:
                                'Game Mode',

                            value:
                                `${gameEmoji} **${displayName}**`,

                            inline:
                                false
                        },

                        {
                            name:
                                'Previous Rank',

                            value:
                                `\`${previousTier}\``,

                            inline:
                                false
                        },

                        {
                            name:
                                'Rank Earned',

                            value:
                                `\`${retiredTier}\``,

                            inline:
                                false
                        }
                    ],

                    footer: {
                        text:
                            'UniversalTiers  Minecraft Tier Testing'
                    },

                    timestamp:
                        new Date()
                };

                await resultChannel.send({
                    content:
                        `${user}`,

                    embeds:
                        [resultEmbed]
                });
            }

            // =====================================================
            // SUCCESS
            // =====================================================

            const unixCooldown =
                Math.floor(
                    cooldownUntil.getTime() /
                    1000
                );

            await interaction.editReply({
                content:
                    `<:tick:1570104808055111742> Result submitted for **${player.ign}** in **${gamemode}**.\n\n` +
                    `Previous Tier: **${previousTier}**\n` +
                    `New Tier: **${retiredTier}**\n\n` +
                    ` **${gamemode} cooldown:** <t:${unixCooldown}:R>`
            });

        } catch (error) {

            console.error(
                '<:crosss:1570104768628531290> RP COMMAND ERROR:',
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.editReply({
                    content:
                        '<:crosss:1570104768628531290> An error occurred while submitting the result. Check the console.'
                }).catch(() => {});

            } else {

                await interaction.reply({
                    content:
                        '<:crosss:1570104768628531290> An error occurred while submitting the result.',
                    flags:
                        MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
};