
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');

const HIGH_TEST_CATEGORY_ID = '1538792400737148978';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Give a player access to this High Test ticket')
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('Player to add to this ticket')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.roles.ownerId) {
            return interaction.reply({
                content: '<:crosss:1567480131713241108> Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = interaction.channel;

        if (
            !channel ||
            channel.parentId !== HIGH_TEST_CATEGORY_ID ||
            !channel.topic?.includes('HT_USER:')
        ) {
            return interaction.reply({
                content: '<:crosss:1567480131713241108> Use this command inside a High Test ticket.',
                flags: MessageFlags.Ephemeral
            });
        }

        const player = interaction.options.getUser('player');

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            await channel.permissionOverwrites.edit(player.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            return interaction.editReply({
                content: `<:tick:1567480091267825714> ${player} has been added to this ticket.`
            });
        } catch (error) {
            console.error('HIGH TEST ADD ERROR:', error);

            return interaction.editReply({
                content: '<:crosss:1567480131713241108> Failed to give the player access to this ticket. Check the bot permissions.'
            });
        }
    }
};
