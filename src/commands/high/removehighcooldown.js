
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');
const supabase = require('../../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removehighcooldown')
        .setDescription('Remove a player’s High Test cooldown')
        .addUserOption(option =>
            option
                .setName('player')
                .setDescription('Player whose High Test cooldown you want to remove')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.roles.ownerId) {
            return interaction.reply({
                content: '<:crosss:1567480131713241108> Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const player = interaction.options.getUser('player');

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            const { data, error } = await supabase
                .from('testing_cooldowns')
                .delete()
                .eq('discord_id', player.id)
                .eq('gamemode', 'HighTest')
                .select('discord_id');

            if (error) {
                console.error('REMOVE HIGH TEST COOLDOWN ERROR:', error);

                return interaction.editReply({
                    content: '<:crosss:1567480131713241108> Failed to remove the High Test cooldown. Check the database.'
                });
            }

            if (!data || data.length === 0) {
                return interaction.editReply({
                    content: `ℹ️ ${player} does not have a High Test cooldown.`
                });
            }

            return interaction.editReply({
                content: `<:tick:1567480091267825714> Removed the High Test cooldown for ${player}. They can request another High Test without waiting for the old cooldown.`
            });
        } catch (error) {
            console.error('REMOVE HIGH TEST COOLDOWN ERROR:', error);

            return interaction.editReply({
                content: '<:crosss:1567480131713241108> An unexpected error occurred while removing the cooldown.'
            });
        }
    }
};
