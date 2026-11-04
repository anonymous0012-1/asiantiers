const {
    SlashCommandBuilder
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const queueRenderer = require('../../queue/queueRenderer');
const perms = require('../../utils/permissions');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('waitlistclose')
        .setDescription('Closes the testing queue for this gamemode'),

    async execute(interaction) {

        // Tester check
        if (!perms.isTester(interaction.member)) {

            return interaction.reply({
                content: '<:crosss:1567480131713241108> Only testers can use this command.',
                flags: 64
            });
        }

        // Find gamemode from current channel
        const gamemode =
            config.channels.queues?.[interaction.channelId];

        if (!gamemode) {

            return interaction.reply({
                content:
                    '<:crosss:1567480131713241108> This channel is not a registered testing queue.',
                flags: 64
            });
        }

        // Acknowledge interaction
        await interaction.deferReply({
            flags: 64
        });

        try {

            // =============================================
            // CLOSE QUEUE
            // =============================================

            const { error: closeError } = await supabase
                .from('queues')
                .update({
                    status: 'CLOSED',
                    tester_id: null,
                    closed_at: new Date().toISOString()
                })
                .eq('gamemode', gamemode);

            if (closeError) {

                console.error(
                    'QUEUE CLOSE DATABASE ERROR:',
                    closeError
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Failed to close the queue.'
                });
            }

            // =============================================
            // CLEAR WAITING PLAYERS
            // =============================================

            const { error: deleteError } = await supabase
                .from('queue_members')
                .delete()
                .eq('gamemode', gamemode);

            if (deleteError) {

                console.error(
                    'QUEUE MEMBERS CLEAR ERROR:',
                    deleteError
                );

                return interaction.editReply({
                    content:
                        '⚠️ Queue was closed, but the waiting players could not be removed from the queue.'
                });
            }

            // =============================================
            // UPDATE QUEUE PANEL
            // =============================================

            try {

                await queueRenderer.updateQueuePanel(
                    interaction.client,
                    gamemode
                );

            } catch (error) {

                console.error(
                    'QUEUE PANEL UPDATE ERROR:',
                    error
                );
            }

            // =============================================
            // SUCCESS
            // =============================================

            return interaction.editReply({
                content:
                    `🔒 **${gamemode}** queue has been closed.\n` +
                    `🗑️ All players were removed from the queue.`
            });

        } catch (error) {

            console.error(
                'WAITLIST CLOSE ERROR:',
                error
            );

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Something went wrong while closing the queue.'
                }).catch(() => {});

            }

            return interaction.reply({
                content:
                    '<:crosss:1567480131713241108> Something went wrong while closing the queue.',
                flags: 64
            }).catch(() => {});
        }
    }
};