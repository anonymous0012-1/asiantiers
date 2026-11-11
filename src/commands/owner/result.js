const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');
const emojis = require('../../config/emojis');
const supabase = require('../../database/supabase');
const perms = require('../../utils/permissions');
const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rp')
        .setDescription('Submit a test result')

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
                    { name: 'HT3', value: 'HT3' },
                    { name: 'LT3', value: 'LT3' },
                    { name: 'HT4', value: 'HT4' },
                    { name: 'LT4', value: 'LT4' },
                    { name: 'HT5', value: 'HT5' },
                    { name: 'LT5', value: 'LT5' }
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
                    { name: 'Crystal', value: 'Crystal' },
                    { name: 'NethPot', value: 'NethPot' },
                    { name: 'DiaPot', value: 'DiaPot' },
                    { name: 'SMP', value: 'SMP' },
                    { name: 'UHC', value: 'UHC' },
                    { name: 'SpearMace', value: 'spearmace' },
                    { name: 'Diamond SMP', value: 'diasmp' },
                    { name: 'Manhunt', value: 'manhunt' },
                    { name: 'ShieldLess UHC', value: 'shieldlessuhc' }
                )
        ),

    async execute(interaction) {

        // =====================================================
        // TESTER CHECK
        // =====================================================

        if (!perms.isTester(interaction.member)) {
            return interaction.reply({
                content: '<:crosss:1567480131713241108> Unauthorized.',
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
                    '<:crosss:1567480131713241108> PLAYER LOOKUP ERROR:',
                    playerError
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Database error while finding the player.'
                });
            }

            if (!player) {

                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Player profile not found.'
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
                    '<:crosss:1567480131713241108> PREVIOUS TIER LOOKUP ERROR:',
                    previousError
                );
            }

            const previousTier =
                previousResult?.new_tier || 'Unranked';

            // =====================================================
            // TIER ROLE CONFIG
            // =====================================================

            const gamemodeTiers =
                config.tiers?.[gamemode];

            if (!gamemodeTiers) {

                return interaction.editReply({
                    content:
                        `<:crosss:1567480131713241108> Tier roles for **${gamemode}** are not configured.`
                });
            }

            const newRoleId =
                gamemodeTiers[tier];

            if (!newRoleId) {

                return interaction.editReply({
                    content:
                        `<:crosss:1567480131713241108> Role for **${tier} ${gamemode}** was not found.`
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

            const allGamemodeRoles =
                Object.values(gamemodeTiers);

            const rolesUserHas =
                allGamemodeRoles.filter(roleId =>
                    member.roles.cache.has(roleId)
                );

            if (rolesUserHas.length > 0) {

                await member.roles.remove(
                    rolesUserHas,
                    'Updating AsianTiers tier'
                );
            }

            // =====================================================
            // ADD NEW TIER ROLE
            // =====================================================

            await member.roles.add(
                newRoleId,
                'AsianTiers test result'
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
                    new_tier: tier,
                    tester_id: interaction.user.id
                });

            if (insertError) {

                console.error(
                    '<:crosss:1567480131713241108> RESULT INSERT ERROR:',
                    insertError
                );

                return interaction.editReply({
                    content:
                        '⚠️ Discord role was updated, but the result could not be saved.'
                });
            }

            console.log(
                `<:tick:1567480091267825714> Result saved: ${player.ign} | ${gamemode} | ${previousTier} → ${tier}`
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
                    '<:crosss:1567480131713241108> COOLDOWN SAVE ERROR:',
                    cooldownError
                );

                return interaction.editReply({
                    content:
                        '⚠️ Result was saved, but the 7-day cooldown could not be saved.'
                });
            }

            console.log(
                `<:tick:1567480091267825714> ${user.tag} received a 7-day ${gamemode} cooldown.`
            );

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
                                ign: player.ign,
                                tier: tier,
                                gamemode:
                                    gamemode.toLowerCase()
                            })
                        }
                    );

                const websiteText =
                    await websiteResponse.text();

                console.log(
                    '🌐 Website API Status:',
                    websiteResponse.status
                );

                console.log(
                    '🌐 Website API Response:',
                    websiteText
                );

                if (!websiteResponse.ok) {

                    console.error(
                        '<:crosss:1567480131713241108> Website sync failed!'
                    );

                } else {

                    console.log(
                        '<:tick:1567480091267825714> Website tier synced successfully!'
                    );
                }

            } catch (error) {

                console.error(
                    '<:crosss:1567480131713241108> WEBSITE SYNC ERROR:',
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
                        `${player.ign}'s Tier Update 🏆`,

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
                                `\`${tier}\``,

                            inline:
                                false
                        }
                    ],

                    footer: {
                        text:
                            'AsianTiers • Minecraft Tier Testing'
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
                    `<:tick:1567480091267825714> Result submitted for **${player.ign}** in **${gamemode}**.\n\n` +
                    `Previous Tier: **${previousTier}**\n` +
                    `New Tier: **${tier}**\n\n` +
                    `⏳ **${gamemode} cooldown:** <t:${unixCooldown}:R>`
            });

        } catch (error) {

            console.error(
                '<:crosss:1567480131713241108> RP COMMAND ERROR:',
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> An error occurred while submitting the result. Check the console.'
                }).catch(() => {});

            } else {

                await interaction.reply({
                    content:
                        '<:crosss:1567480131713241108> An error occurred while submitting the result.',
                    flags:
                        MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }
    }
};