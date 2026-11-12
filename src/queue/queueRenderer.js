const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('../config/config');
const emojis = require('../config/emojis');
const supabase = require('../database/supabase');

function normalizeGamemode(value) {
    return String(value ?? '').trim().toLowerCase();
}

async function fetchAllQueues() {
    const { data, error } = await supabase
        .from('queues')
        .select('*');

    if (error) {
        throw error;
    }

    return data || [];
}

function resolveQueueRow(allQueues, gamemode, channelId) {
    const requested = normalizeGamemode(gamemode);

    // 1. Exact normalized gamemode match.
    let row = allQueues.find(queue =>
        normalizeGamemode(queue?.gamemode) === requested
    );

    // 2. Match by the configured Discord channel id.
    if (!row && channelId) {
        row = allQueues.find(queue =>
            String(queue?.channel_id) === String(channelId)
        );
    }

    // 3. Match by any configured channel whose mapped gamemode normalizes.
    if (!row) {
        const configuredChannelId = Object.keys(config.channels.queues || {})
            .find(key => normalizeGamemode(config.channels.queues[key]) === requested);

        if (configuredChannelId) {
            row = allQueues.find(queue =>
                String(queue?.channel_id) === String(configuredChannelId)
            );
        }
    }

    return row || null;
}

module.exports = {

    async updateQueuePanel(client, gamemode) {

        console.log('\n========== QUEUE PANEL UPDATE ==========');
        console.log('Gamemode:', gamemode);

        try {

            // ==========================================
            // 1. FETCH ALL QUEUES (SAME SUPABASE CLIENT)
            // ==========================================

            let allQueues;

            try {
                allQueues = await fetchAllQueues();
            } catch (error) {
                console.error(
                    `[${gamemode}] QUEUE DATABASE ERROR:`,
                    error
                );
                return;
            }

            console.log(
                `[${gamemode}] Available queue gamemodes in Supabase:`,
                allQueues.map(queue => JSON.stringify(queue?.gamemode))
            );

            const configuredChannelId =
                Object.keys(config.channels.queues || {})
                    .find(key => config.channels.queues[key] === gamemode);

            const queue = resolveQueueRow(
                allQueues,
                gamemode,
                configuredChannelId
            );

            if (!queue) {
                console.error(
                    `[${gamemode}] NO QUEUE ROW FOUND IN SUPABASE.`
                );
                console.error(
                    `[${gamemode}] Requested normalized gamemode:`,
                    normalizeGamemode(gamemode)
                );
                return;
            }

            // Use the database's actual gamemode value for DB operations.
            const dbGamemode = queue.gamemode;

            console.log('Queue row found:', queue);

            if (!queue.channel_id) {
                console.error(
                    `[${gamemode}] Queue channel_id is NULL or empty.`
                );
                return;
            }

            // ==========================================
            // 2. FETCH QUEUE MEMBERS
            // ==========================================

            const { data: allMembers, error: membersError } = await supabase
                .from('queue_members')
                .select('*');

            if (membersError) {
                console.error(
                    `[${gamemode}] QUEUE MEMBERS ERROR:`,
                    membersError
                );
                return;
            }

            const requestedNorm = normalizeGamemode(gamemode);
            const dbNorm = normalizeGamemode(dbGamemode);

            const queueMembers = (allMembers || [])
                .filter(member => {
                    const memberNorm = normalizeGamemode(member?.gamemode);
                    return memberNorm === requestedNorm || memberNorm === dbNorm;
                })
                .sort((a, b) => {
                    const priorityDiff = Number(Boolean(b?.priority)) - Number(Boolean(a?.priority));
                    if (priorityDiff !== 0) return priorityDiff;

                    return new Date(a?.joined_at || 0) - new Date(b?.joined_at || 0);
                });

            // ==========================================
            // 3. FETCH DISCORD CHANNEL
            // ==========================================

            let channel;

            try {
                channel = await client.channels.fetch(
                    String(queue.channel_id)
                );
            } catch (error) {
                console.error(
                    `[${gamemode}] CHANNEL FETCH ERROR:`,
                    error
                );
                return;
            }

            if (!channel || !channel.isTextBased() || !channel.messages) {
                console.error(
                    `[${gamemode}] INVALID OR NON-TEXT CHANNEL:`,
                    queue.channel_id
                );
                return;
            }

            console.log('Discord channel found:', channel.id);

            // ==========================================
            // 4. GAMEMODE DETAILS
            // ==========================================

            const gameEmoji =
                emojis.gamemodes?.[gamemode] ||
                emojis.gamemodes?.[dbGamemode] ||
                '';

            const displayName =
                config.gamemodeNames?.[gamemode] ||
                config.gamemodeNames?.[dbGamemode] ||
                gamemode;

            const testerEmoji =
                emojis.tester ||
                emojis.ui?.tester ||
                '';

            const openEmoji =
                emojis.ui?.queueopen || '🟢';

            const closeEmoji =
                emojis.ui?.queueclose || '<:close:1570105019326275604>';

            // ==========================================
            // 5. BUILD QUEUE EMBED AND BUTTONS
            // ==========================================

            let embed;
            let row;

            if (queue.status !== 'OPEN') {

                embed = new EmbedBuilder()
                    .setTitle(
                        `${closeEmoji} ${displayName} Queue Closed`
                    )
                    .setColor(0xED4245)
                    .setDescription(
                        'This testing session has ended. You will be notified here when a new queue opens.'
                    )
                    .addFields(
                        {
                            name: '<:updates:1570104881262366861> Reason',
                            value: 'Queue closed by command',
                            inline: false
                        },
                        {
                            name: '🕐 Session Ended',
                            value: queue.closed_at
                                ? `<t:${Math.floor(
                                    new Date(queue.closed_at).getTime() / 1000
                                )}:F>`
                                : `<t:${Math.floor(Date.now() / 1000)}:F>`,
                            inline: false
                        }
                    )
                    .setFooter({
                        text: 'UniversalTiers • Thank you for testing!'
                    });

                row = new ActionRowBuilder().addComponents(

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

            } else {

                let queueList = 'No players waiting.';

                if (queueMembers.length > 0) {

                    queueList = queueMembers
                        .map((member, index) => {

                            const priority = member.priority
                                ? ' ⭐'
                                : '';

                            return `${index + 1}. <@${member.discord_id}>${priority}`;

                        })
                        .join('\n');

                    // Discord embed field limit: 1024 characters
                    if (queueList.length > 1024) {
                        queueList = queueList.substring(0, 1000) +
                            '\n...and more players.';
                    }
                }

                const tester = queue.tester_id
                    ? `<@${queue.tester_id}>`
                    : 'No tester currently assigned';

                embed = new EmbedBuilder()
                    .setTitle(
                        `${gameEmoji} ${displayName} Testing Queue`
                    )
                    .setColor(0x5865F2)
                    .setDescription(
                        `${testerEmoji} **Tester(s) Available!**\n\n` +
                        '🕐 The queue updates automatically.\n' +
                        'Use **Join Queue** / **Leave Queue** to manage your position.'
                    )
                    .addFields(
                        {
                            name: `Queue (${queueMembers.length})`,
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
                        text: 'UniversalTiers • Testing Queue'
                    })
                    .setTimestamp();

                row = new ActionRowBuilder().addComponents(

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
            }

            // ==========================================
            // 6. UPDATE EXISTING PANEL OR CREATE NEW ONE
            // ==========================================

            let panelMessage = null;

            if (queue.panel_message_id) {

                try {

                    panelMessage = await channel.messages.fetch(
                        queue.panel_message_id
                    );

                    await panelMessage.edit({
                        embeds: [embed],
                        components: [row]
                    });

                    console.log(
                        `[${gamemode}] Existing queue panel updated.`
                    );

                    return;

                } catch (error) {

                    console.warn(
                        `[${gamemode}] Existing panel unavailable. Creating a new one.`,
                        error.message
                    );

                    panelMessage = null;
                }
            }

            // ==========================================
            // 7. CREATE NEW PANEL
            // ==========================================

            try {

                panelMessage = await channel.send({
                    embeds: [embed],
                    components: [row]
                });

                console.log(
                    `[${gamemode}] New queue panel created:`,
                    panelMessage.id
                );

            } catch (error) {

                console.error(
                    `[${gamemode}] FAILED TO SEND QUEUE PANEL:`,
                    error
                );

                return;
            }

            // ==========================================
            // 8. SAVE PANEL MESSAGE ID
            // ==========================================

            const { error: saveError } = await supabase
                .from('queues')
                .update({
                    panel_message_id: panelMessage.id
                })
                .eq('gamemode', dbGamemode);

            if (saveError) {

                console.error(
                    `[${gamemode}] PANEL MESSAGE ID SAVE ERROR:`,
                    saveError
                );

                return;
            }

            console.log(
                `[${gamemode}] Queue panel message ID saved successfully.`
            );

        } catch (error) {

            console.error(
                `[${gamemode}] QUEUE PANEL UPDATE FAILED:`,
                error
            );
        }

        console.log('========== QUEUE PANEL UPDATE END ==========\n');
    }
};