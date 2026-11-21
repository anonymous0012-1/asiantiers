const {
    SlashCommandBuilder,
    MessageFlags,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const perms = require('../../utils/permissions');
const roleConfig = require('../../utils/roleConfig');

const HIGH_TEST_CATEGORY_ID = '1570452104458276955';
const STAFF_ROLE_ID = '1571847726621003822';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evalpass')
        .setDescription('Move the current testing ticket into High Testing')
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
        if (!perms.isTester(interaction.member)) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> Only testers can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.channel;
        const topic = channel.topic || '';
        const userMatch = topic.match(/PLAYER:(\d+)/);

        if (!userMatch || channel.parentId !== config.channels.ticketCategory) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> Use this command inside a normal testing ticket.',
                flags: MessageFlags.Ephemeral
            });
        }

        const playerId = userMatch[1];
        const gamemode = interaction.options.getString('gamemode');

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        // Fetch staff roles
        const { data: staffRoles, error: staffRolesError } = await supabase
            .from('high_test_staff_roles')
            .select('role_id');

        if (staffRolesError) {
            console.error('EVALPASS STAFF ROLES ERROR:', staffRolesError);
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Could not load High Test staff roles.'
            });
        }

        const staffRoleIds = (staffRoles || [])
            .map(row => String(row.role_id))
            .filter(id => /^\d+$/.test(id));

        // Fetch player profile
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('discord_id', playerId)
            .maybeSingle();

        if (playerError || !player) {
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Player profile not found.'
            });
        }

        const safeName = player.ign
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 18) || 'player';

        // Resolve users and roles to avoid "not a cached User or Role" errors
        const everyoneRole = interaction.guild.roles.everyone;

        let playerUser = null;
        try { playerUser = await interaction.client.users.fetch(playerId); } catch (e) { console.error(e); }

        let ownerUser = null;
        try { ownerUser = await interaction.client.users.fetch(config.ownerId); } catch (e) { console.error(e); }

        const botUser = interaction.client.user;

        const permissionOverwrites = [
            {
                id: everyoneRole,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: playerUser || playerId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            },
            {
                id: ownerUser || config.ownerId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            },
            {
                id: botUser,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.AttachFiles
                ]
            }
        ];

        for (const roleId of staffRoleIds) {
            let role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                try { role = await interaction.guild.roles.fetch(roleId); } catch (e) { role = null; }
            }
            if (role) {
                permissionOverwrites.push({
                    id: role,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                });
            }
        }

        // Ensure required staff role is included even if not in DB
        if (!staffRoleIds.includes(STAFF_ROLE_ID)) {
            let role = interaction.guild.roles.cache.get(STAFF_ROLE_ID);
            if (!role) {
                try { role = await interaction.guild.roles.fetch(STAFF_ROLE_ID); } catch (e) { role = null; }
            }
            if (role) {
                permissionOverwrites.push({
                    id: role,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ]
                });
            }
        }

        try {
            // Move to high testing category
            await channel.setParent(HIGH_TEST_CATEGORY_ID, { lockPermissions: false });
            await channel.setName(`ht-${safeName}`);
            await channel.setTopic(`HT_USER:${playerId} | GAMEMODE:${gamemode}`);

            // Apply permission overwrites
            await channel.permissionOverwrites.set(permissionOverwrites);
        } catch (error) {
            console.error('EVALPASS MOVE ERROR:', error);
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Failed to move the ticket into High Testing.'
            });
        }

        // Remove previous normal testing panel
        try {
            const messages = await channel.messages.fetch({ limit: 50 });
            for (const msg of messages.values()) {
                if (!msg.author?.bot) continue;
                const isNormalPanel = msg.components?.some(row =>
                    row.components?.some(c =>
                        ['test_close', 'test_skip', 'test_tier_select'].includes(c.customId)
                    )
                );
                if (isNormalPanel) {
                    await msg.delete().catch(() => {});
                }
            }
        } catch (e) {
            console.error('EVALPASS PANEL CLEANUP ERROR:', e);
        }

        // Send high testing panel
        const emojis = require('../../config/emojis');
        const gameEmoji = emojis.gamemodes?.[gamemode] || '';
        const displayName = config.gamemodeNames?.[gamemode] || gamemode;

        const ticketEmbed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle(`${gameEmoji} ${displayName} High Test Ticket`)
            .setDescription(`Welcome <@${playerId}>!\n\nYour High Test application has been created.\nA tester will review your application shortly.`)
            .addFields(
                { name: 'Player', value: `<@${playerId}>\n\`${player.ign}\``, inline: true },
                { name: 'Gamemode', value: `${gameEmoji} **${displayName}**`, inline: true }
            )
            .setFooter({ text: 'UniversalTiers High Tests' })
            .setTimestamp();

        const ticketButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('high_ticket_close')
                    .setLabel('Close')
                    .setEmoji('<:crosss:1570104768628531290>')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('high_ticket_skip')
                    .setLabel('Skip')
                    .setEmoji('<:tick:1570104808055111742>')
                    .setStyle(ButtonStyle.Secondary)
            );

        await channel.send({
            content: [
                `<@${playerId}>`,
                ...staffRoleIds.map(roleId => `<@&${roleId}>`),
                `<@&${STAFF_ROLE_ID}>`
            ].join(' '),
            embeds: [ticketEmbed],
            components: [ticketButtons]
        });

        return interaction.editReply({
            content: `<:tick:1570104808055111742> Ticket moved to High Testing: ${channel}`
        });
    }
};