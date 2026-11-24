const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const roleConfig = require('../../utils/roleConfig');
const perms = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forcetest')
        .setDescription('Force-create a testing ticket for a player')
        .addUserOption(opt =>
            opt
                .setName('user')
                .setDescription('The player')
                .setRequired(true)
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
                    { name: 'Cart', value: 'cart' },
                    { name: 'Speed', value: 'Speed' }
                )
        ),

    async execute(interaction) {
        if (!perms.isTester(interaction.member)) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> Only testers can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        const user = interaction.options.getUser('user');
        const gamemode = interaction.options.getString('gamemode');

        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('discord_id', user.id)
            .maybeSingle();

        if (playerError || !player) {
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Player profile not found.'
            });
        }

        const guild = interaction.guild;

        let ticketChannel;
        try {
            ticketChannel = await guild.channels.create({
                name: `test-${player.ign}`,
                type: ChannelType.GuildText,
                parent: config.channels.ticketCategory,
                topic: `PLAYER:${user.id} | GAMEMODE:${gamemode}`,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },
                    {
                        id: roleConfig.getRoleIdSync('tester') || '1570451868943908884',
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles
                        ]
                    }
                ]
            });
        } catch (error) {
            console.error('FORCETEST TICKET CREATION ERROR:', error);
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Failed to create the testing ticket.'
            });
        }

        const { error: sessionError } = await supabase
            .from('testing_sessions')
            .insert({
                player_discord_id: user.id,
                tester_id: interaction.user.id,
                gamemode: gamemode,
                ticket_channel_id: ticketChannel.id
            });

        if (sessionError) {
            console.error('FORCETEST SESSION INSERT ERROR:', sessionError);
            await ticketChannel.delete().catch(() => {});
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Failed to create the testing session.'
            });
        }

        const { data: lastResult } = await supabase
            .from('results')
            .select('new_tier')
            .eq('discord_id', user.id)
            .eq('gamemode', gamemode)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const emojis = require('../../config/emojis');
        const gameEmoji = emojis.gamemodes?.[gamemode] || '';

        const infoEmbed = new EmbedBuilder()
            .setTitle(`Testing Session: ${player.ign}`)
            .setColor(config.colors.primary)
            .addFields(
                { name: 'Discord', value: `<@${user.id}>`, inline: true },
                { name: 'IGN', value: player.ign, inline: true },
                { name: 'Region', value: player.region || 'Not set', inline: true },
                { name: 'Account', value: player.account_type || 'Not set', inline: true },
                { name: 'Gamemode', value: `${gameEmoji} ${gamemode}`, inline: true },
                { name: 'Current Tier', value: lastResult?.new_tier || 'Unranked', inline: true }
            )
            .setFooter({ text: `Tester: ${interaction.user.tag}` })
            .setTimestamp();

        const ticketButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('test_close')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('test_skip')
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Secondary)
            );

        await ticketChannel.send({
            content: `<@${user.id}>, your test is ready!`,
            embeds: [infoEmbed],
            components: [ticketButtons]
        });

        return interaction.editReply({
            content: `<:tick:1570104808055111742> Ticket created: ${ticketChannel}`
        });
    }
};