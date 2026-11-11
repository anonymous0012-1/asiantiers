const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const queueRenderer = require('../../queue/queueRenderer');
const perms = require('../../utils/permissions');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('waitlistopen')
        .setDescription('Opens the testing queue for the current gamemode'),

    async execute(interaction) {

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {

            // -----------------------------------------
            // TESTER CHECK
            // -----------------------------------------

            if (!perms.isTester(interaction.member)) {
                return interaction.editReply({
                    content: '<:crosss:1567480131713241108> Only testers can use this command.'
                });
            }

            // -----------------------------------------
            // FIND GAMEMODE
            // -----------------------------------------

            const gamemode =
                config.channels.queues[interaction.channelId];

            if (!gamemode) {
                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> This channel is not a registered queue channel.'
                });
            }

            // -----------------------------------------
            // RESOLVE QUEUE ROW (ROBUST TO DB VALUE)
            // -----------------------------------------

            const { data: allQueues, error: fetchError } = await supabase
                .from('queues')
                .select('*');

            if (fetchError) {
                console.error('Queue fetch error:', fetchError);
                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Failed to fetch queue configuration.'
                });
            }

            const queueRow = (allQueues || []).find(row =>
                String(row.channel_id) === String(interaction.channelId)
            ) || (allQueues || []).find(row =>
                String(row.gamemode || '').trim().toLowerCase() ===
                String(gamemode).trim().toLowerCase()
            );

            if (!queueRow) {
                console.error(
                    `[${gamemode}] NO QUEUE ROW FOUND IN SUPABASE.`,
                    'Available:',
                    (allQueues || []).map(row => JSON.stringify(row.gamemode))
                );
                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> No queue row found for this gamemode.'
                });
            }

            const dbGamemode = queueRow.gamemode;

            // -----------------------------------------
            // OPEN QUEUE
            // -----------------------------------------

            const { data: updatedRows, error } = await supabase
                .from('queues')
                .update({
                    status: 'OPEN',
                    tester_id: interaction.user.id,
                    opened_at: new Date().toISOString()
                })
                .eq('channel_id', String(interaction.channelId))
                .select('gamemode');

            if (error) {
                console.error(
                    'Queue open database error:',
                    error
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Failed to open the queue in the database.'
                });
            }

            if (!updatedRows || updatedRows.length === 0) {
                console.error(
                    `[${gamemode}] Queue update affected 0 rows.`
                );
                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Failed to open the queue in the database.'
                });
            }

            // -----------------------------------------
            // UPDATE PANEL
            // -----------------------------------------

try {
    await queueRenderer.updateQueuePanel(
        interaction.client,
        gamemode
    );
} catch (error) {
    console.error('QUEUE PANEL UPDATE ERROR:', error);
}

            // -----------------------------------------
            // @HERE PING
            // -----------------------------------------

            const pingMessage = await interaction.channel.send({
                content: '@here',
                allowedMentions: {
                    parse: ['everyone']
                }
            });

            // Delete ping message after 1 second
            setTimeout(async () => {
                await pingMessage.delete().catch(() => {});
            }, 1000);

            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            await interaction.editReply({
                content:
                    `🟢 **${gamemode}** testing queue is now OPEN.`
            });

        } catch (error) {

            console.error(
                'WAITLIST OPEN ERROR:',
                error
            );

            if (interaction.deferred) {
                await interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Something went wrong while opening the queue.'
                }).catch(() => {});
            }
        }
    }
};