const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('../config/config');
const emojis = require('../config/emojis');
const supabase = require('../database/supabase');

module.exports = {

    async updateQueuePanel(client, gamemode) {

        const { data: queue, error: queueError } = await supabase
            .from('queues')
            .select('*')
            .eq('gamemode', gamemode)
            .maybeSingle();

        if (queueError) {
            console.error('Queue fetch error:', queueError);
            return;
        }

        if (!queue || !queue.channel_id) {
            console.log(`No queue configured for ${gamemode}`);
            return;
        }

        const { data: members, error: membersError } = await supabase
            .from('queue_members')
            .select('*')
            .eq('gamemode', gamemode)
            .order('priority', {
                ascending: false
            })
            .order('joined_at', {
                ascending: true
            });

        if (membersError) {
            console.error('Queue members error:', membersError);
            return;
        }

        const channel = await client.channels.fetch(queue.channel_id);

        if (!channel) {
            console.error(`Queue channel not found: ${queue.channel_id}`);
            return;
        }

        // Custom gamemode emoji
        const gameEmoji =
            emojis.gamemodes?.[gamemode] || '';

        const displayName =
            config.gamemodeNames?.[gamemode] || gamemode;

        // Custom tester emoji
        const testerEmoji =
            emojis.tester ||
            emojis.ui?.tester ||
            '';

        // Custom queue open/close emojis
        const openEmoji =
            emojis.ui?.queueopen || '';

        const closeEmoji =
            emojis.ui?.queueclose || '';

        /*
        =====================================================
        CLOSED QUEUE
        =====================================================
        */

        if (queue.status !== 'OPEN') {

            const closedEmbed = new EmbedBuilder()
                .setTitle(
                    `${closeEmoji || '🔒'} ${displayName} Queue Closed`
                )
                .setColor(0xED4245)
                .setDescription(
                    `This testing session has ended. You will be notified here when a new queue opens.`
                )
                .addFields(
                    {
                        name: '📋 Reason',
                        value: 'Queue closed by command',
                        inline: false
                    },
                    {
                        name: '🕐 Session Ended',
                        value: queue.closed_at
                            ? `<t:${Math.floor(new Date(queue.closed_at).getTime() / 1000)}:F>`
                            : `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: false
                    }
                )
                .setFooter({
                    text: 'AsianTiers • Thank you for testing!'
                });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_queue_${gamemode}`)
                    .setLabel('Join Queue')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),

                new ButtonBuilder()
                    .setCustomId(`leave_queue_${gamemode}`)
                    .setLabel('Leave Queue')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true),

                new ButtonBuilder()
                    .setCustomId(`refresh_queue_${gamemode}`)
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
            );

            try {

                if (queue.panel_message_id) {

                    const message = await channel.messages.fetch(
                        queue.panel_message_id
                    );

                    await message.edit({
                        embeds: [closedEmbed],
                        components: [row]
                    });

                } else {

                    const message = await channel.send({
                        embeds: [closedEmbed],
                        components: [row]
                    });

                    await supabase
                        .from('queues')
                        .update({
                            panel_message_id: message.id
                        })
                        .eq('gamemode', gamemode);
                }

            } catch (error) {

                console.log(
                    `Creating new ${gamemode} closed queue panel...`
                );

                const message = await channel.send({
                    embeds: [closedEmbed],
                    components: [row]
                });

                await supabase
                    .from('queues')
                    .update({
                        panel_message_id: message.id
                    })
                    .eq('gamemode', gamemode);
            }

            return;
        }

        /*
        =====================================================
        OPEN QUEUE
        =====================================================
        */

        let queueList = 'No players waiting.';

        if (members && members.length > 0) {

            queueList = members
                .map((member, index) => {

                    const priority =
                        member.priority
                            ? ' ⭐'
                            : '';

                    return `${index + 1}. <@${member.discord_id}>${priority}`;

                })
                .join('\n');
        }

        const tester =
            queue.tester_id
                ? `<@${queue.tester_id}>`
                : 'No tester currently assigned';

        const openEmbed = new EmbedBuilder()
            .setTitle(
                `${gameEmoji} ${displayName} Testing Queue`
            )
            .setColor(0x5865F2)
            .setDescription(
                `${testerEmoji} **Tester(s) Available!**\n\n` +
                `🕐 The queue updates automatically.\n` +
                `Use **Join Queue** / **Leave Queue** to manage your position.`
            )
            .addFields(
                {
                    name: `Queue (${members?.length || 0})`,
                    value: queueList,
                    inline: false
                },
                {
                    name: 'Active Tester',
                    value: tester,
                    inline: false
                }
            )
            .setFooter({
                text: 'AsianTiers • Testing Queue'
            })
            .setTimestamp();

        const openRow = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId(`join_queue_${gamemode}`)
                .setLabel('Join Queue')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`leave_queue_${gamemode}`)
                .setLabel('Leave Queue')
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId(`refresh_queue_${gamemode}`)
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

        try {

            if (queue.panel_message_id) {

                const message = await channel.messages.fetch(
                    queue.panel_message_id
                );

                await message.edit({
                    embeds: [openEmbed],
                    components: [openRow]
                });

            } else {

                const message = await channel.send({
                    embeds: [openEmbed],
                    components: [openRow]
                });

                await supabase
                    .from('queues')
                    .update({
                        panel_message_id: message.id
                    })
                    .eq('gamemode', gamemode);
            }

        } catch (error) {

            console.log(
                `Creating new ${gamemode} open queue panel...`
            );

            const message = await channel.send({
                embeds: [openEmbed],
                components: [openRow]
            });

            await supabase
                .from('queues')
                .update({
                    panel_message_id: message.id
                })
                .eq('gamemode', gamemode);
        }
    }
};