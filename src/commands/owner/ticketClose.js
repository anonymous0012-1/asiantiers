const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');

const config = require('../../config/config');
const perms = require('../../utils/permissions');
const supabase = require('../../database/supabase');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('ticketclose')
        .setDescription('Close the current testing ticket'),

    async execute(interaction) {

        if (!perms.isTester(interaction.member)) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> Only testers can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (
            interaction.channel.parentId !==
            config.channels.ticketCategory
        ) {
            return interaction.reply({
                content:
                    '<:crosss:1570104768628531290> This command can only be used inside a testing ticket.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {

            const ticketChannel = interaction.channel;

            const { error: sessionError } = await supabase
                .from('testing_sessions')
                .update({
                    status: 'COMPLETED',
                    ended_at: new Date().toISOString()
                })
                .eq('ticket_channel_id', ticketChannel.id)
                .eq('status', 'ACTIVE');

            if (sessionError) {
                console.error(
                    'TESTING SESSION UPDATE ERROR:',
                    sessionError
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1570104768628531290> Failed to complete the testing session.'
                });
            }

const transcriptChannel =
    await interaction.guild.channels.fetch(
        config.channels.transcriptChannel
    );

            if (!transcriptChannel) {
                return interaction.editReply({
                    content:
                        '<:crosss:1570104768628531290> Transcript channel was not found.'
                });
            }

            let allMessages = [];
            let lastId = null;

            while (true) {

                const options = {
                    limit: 100
                };

                if (lastId) {
                    options.before = lastId;
                }

                const messages =
                    await ticketChannel.messages.fetch(options);

                if (messages.size === 0) {
                    break;
                }

                allMessages.push(
                    ...Array.from(messages.values())
                );

                lastId =
                    messages.last().id;

                if (messages.size < 100) {
                    break;
                }
            }

            allMessages.reverse();

            let transcript = '';

            transcript +=
                `UniversalTiers Testing Ticket Transcript\n`;

            transcript +=
                `====================================\n\n`;

            transcript +=
                `Ticket: #${ticketChannel.name}\n`;

            transcript +=
                `Closed By: ${interaction.user.tag}\n`;

            transcript +=
                `Guild: ${interaction.guild.name}\n`;

            transcript +=
                `Messages: ${allMessages.length}\n`;

            transcript +=
                `Closed At: ${new Date().toISOString()}\n\n`;

            transcript +=
                `====================================\n\n`;

            for (const message of allMessages) {

                const timestamp =
                    message.createdAt.toISOString();

                const author =
                    message.author
                        ? message.author.tag
                        : 'Unknown User';

                transcript +=
                    `[${timestamp}] ${author}:\n`;

                if (message.content) {
                    transcript +=
                        `${message.content}\n`;
                }

                if (message.attachments.size > 0) {

                    for (
                        const attachment
                        of message.attachments.values()
                    ) {

                        transcript +=
                            `[Attachment] ${attachment.url}\n`;
                    }
                }

                transcript += '\n';
            }

            const transcriptBuffer =
                Buffer.from(transcript, 'utf8');

            const transcriptEmbed =
                new EmbedBuilder()
                    .setTitle('📄 Testing Ticket Transcript')
                    .setColor(0x8B0000)
                    .addFields(
                        {
                            name: 'Ticket',
                            value: `#${ticketChannel.name}`,
                            inline: true
                        },
                        {
                            name: 'Closed By',
                            value: `<@${interaction.user.id}>`,
                            inline: true
                        },
                        {
                            name: 'Messages',
                            value: `${allMessages.length}`,
                            inline: true
                        }
                    )
                    .setFooter({
                        text:
                            'UniversalTiers • Minecraft Tier Testing'
                    })
                    .setTimestamp();

            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                files: [
                    {
                        attachment: transcriptBuffer,
                        name:
                            `${ticketChannel.name}-transcript.txt`
                    }
                ]
            });

            await interaction.editReply({
                content:
                    '<:tick:1570104808055111742> Testing session completed. Transcript saved. Deleting ticket...'
            });

            await ticketChannel.delete(
                'Testing completed - transcript saved'
            );

        } catch (error) {

            console.error(
                'TICKET CLOSE / TRANSCRIPT ERROR:',
                error
            );

            if (
                interaction.deferred &&
                !interaction.replied
            ) {

                await interaction.editReply({
                    content:
                        '<:crosss:1570104768628531290> Failed to create transcript or delete the ticket.'
                }).catch(() => {});
            }
        }
    }
};