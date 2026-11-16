const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/config');
const supabase = require('../../database/supabase');
const roleConfig = require('../../utils/roleConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wipeallroles')
        .setDescription('Remove all roles created by the role setup system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.member?.roles?.cache?.has('1105165947590938866')) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('wipeallroles_confirm')
                .setLabel('Confirm Wipe All Roles')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('wipeallroles_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
            content: '⚠️ This will delete ALL roles managed by the role setup system. This cannot be undone. Confirm?',
            components: [row],
            flags: MessageFlags.Ephemeral
        });
    }
};
