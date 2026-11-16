
const {
    SlashCommandBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const ALLOWED_USER_ID = '1105165947590938866';

if (interaction.user.id !== ALLOWED_USER_ID) {
    return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wipeallroles')
        .setDescription('Remove all roles created by the role setup system')
        .setDefaultMemberPermissions(null),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Fetch actual GuildMember to reliably check role IDs
        let member;

        try {
            member = await interaction.guild.members.fetch(interaction.user.id);
        } catch (error) {
            console.error('[WipeAllRoles] Failed to fetch member:', error);

            return interaction.reply({
                content: '❌ Could not verify your server roles. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Only this exact role can execute the command
        if (!member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
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
