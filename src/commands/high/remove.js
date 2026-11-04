
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');

const HIGH_TEST_CATEGORY_ID = '1538792400737148978';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a player from this High Test ticket')
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('Player to remove from this ticket')
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
            const existingOverwrite = channel.permissionOverwrites.cache.get(player.id);

            if (!existingOverwrite) {
                return interaction.editReply({
                    content: `ℹ️ ${player} does not have a separate access permission in this ticket.`
                });
            }

            await channel.permissionOverwrites.delete(player.id);

            return interaction.editReply({
                content: `<:tick:1567480091267825714> ${player} has been removed from this ticket.`
            });
        } catch (error) {
            console.error('HIGH TEST REMOVE ERROR:', error);

            return interaction.editReply({
                content: "<:crosss:1567480131713241108> Failed to remove the player's ticket access. Check the bot permissions."
            });
        }
    }
};
