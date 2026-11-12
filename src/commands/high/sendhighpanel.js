const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('../../config/config');
const emojis = require('../../config/emojis');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendhighpanel')
        .setDescription('Send the High Tests panel'),

    async execute(interaction) {

        // ==========================================
        // OWNER ONLY
        // ==========================================

        if (
            interaction.user.id !==
            config.roles.ownerId
        ) {
            return interaction.reply({
                content:
                    '<:crosss:1570104768628531290> Only the bot owner can use this command.',
                ephemeral: true
            });
        }

        // ==========================================
        // EMOJIS
        // ==========================================

        const diaPotEmoji =
            emojis.gamemodes?.DiaPot ||
            '<:diapot:1534871592730099743>';

        // EXACT CUSTOM TROPHY EMOJI
        const trophyEmoji =
            '<:T1:1544576709733519380>';

        // ==========================================
        // EMBED
        // ==========================================

        const embed =
            new EmbedBuilder()
                .setColor(0x5865F2)

                .setAuthor({
                    name: 'UniversalTiers | HIGH TESTS — NOW OPEN',
                    iconURL:
                        'https://cdn.discordapp.com/emojis/1534871592730099743.png'
                })

                .setDescription(
                    '> **High Tests are now officially open!**'
                )

                .addFields({
                    name:
                        `${trophyEmoji} | HT Requirements`,

                    value:
                        '• You must be **LT3 or higher** to apply for a High Test.\n' +
                        '• You must pass your **HT Evaluation** before opening an **HT Ticket**.'
                })

                .addFields({
                    name:
                        '────────────────────────────',

                    value:
                        '**Good luck with your tests!**',

                    inline: false
                });

        // ==========================================
        // GAMEMODE BUTTONS
        // ==========================================

        const gamemodes = [
            'Axe',
            'Crystal',
            'Sword',
            'Mace',
            'NethPot',
            'SMP',
            'UHC',
            'DiaPot',
            'spearmace',
            'diasmp',
            'manhunt',
            'shieldlessuhc',
            'cart'
        ];

        const rows = [];

        for (let i = 0; i < gamemodes.length; i += 4) {

            const row =
                new ActionRowBuilder();

            for (
                const gamemode
                of gamemodes.slice(i, i + 4)
            ) {

                const button =
                    new ButtonBuilder()
                        .setCustomId(
                            `high_test_${gamemode}`
                        )
                        .setLabel(
                            gamemode === 'NethPot'
                                ? 'Nethpot'
                                : (config.gamemodeNames?.[gamemode] || gamemode)
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        );

                const emoji =
                    emojis.gamemodes?.[gamemode];

                if (emoji) {

                    const match =
                        emoji.match(
                            /<a?:\w+:(\d+)>/
                        );

                    if (match) {
                        button.setEmoji({
                            id: match[1]
                        });
                    }
                }

                row.addComponents(button);
            }

            rows.push(row);
        }

        // ==========================================
        // SEND PANEL
        // ==========================================

        await interaction.channel.send({
            embeds: [embed],
            components: rows
        });

        return interaction.reply({
            content:
                '<:tick:1570104808055111742> High Tests panel sent.',
            ephemeral: true
        });
    }
};