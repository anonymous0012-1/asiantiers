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
            // OPEN QUEUE
            // -----------------------------------------

            const { error } = await supabase
                .from('queues')
                .update({
                    status: 'OPEN',
                    tester_id: interaction.user.id,
                    opened_at: new Date().toISOString()
                })
                .eq('gamemode', gamemode);

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