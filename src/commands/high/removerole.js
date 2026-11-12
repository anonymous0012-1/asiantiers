
const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');

const config = require('../../config/config');

const HIGH_TEST_CATEGORY_ID = '1538792400737148978';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Remove a role access from this High Test ticket')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to remove ticket access from')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.roles.ownerId) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> Only the bot owner can use this command.',
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
                content: '<:crosss:1570104768628531290> Use this command inside a High Test ticket.',
                flags: MessageFlags.Ephemeral
            });
        }

        const role = interaction.options.getRole('role');

        if (role.id === interaction.guild.id) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> You cannot remove @everyone this way.',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Explicitly deny access, even if the category allows it.
            await channel.permissionOverwrites.edit(role.id, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false,
                AttachFiles: false,
                EmbedLinks: false
            });

            return interaction.reply({
                content: `<:tick:1570104808055111742> ${role} can no longer access this High Test ticket.`,
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('HIGH TEST REMOVEROLE ERROR:', error);

            return interaction.reply({
                content: '<:crosss:1570104768628531290> Failed to update ticket permissions. Check the bot permissions.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};