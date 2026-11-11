const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

const emojis = require('../../config/emojis');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('sendwaitlistpanel')
        .setDescription('Send the AsianTiers testing waitlist panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setTitle('📋 AsianTiers — Testing Waitlist')
            .setColor(0x8B0000)
            .setDescription(
                '**Welcome to the AsianTiers Testing System!**\n\n' +

                '**1. Register Your Profile**\n' +
                'Click **Register / Update Profile** and enter your Minecraft IGN, Region and Account Type.\n\n' +

                '**2. Choose Your Waitlist**\n' +
                'After registering, select a gamemode below to join its testing waitlist.\n\n' +

                '**3. Get Tested**\n' +
                'When a tester becomes available, you will be contacted to begin your test.\n\n' +

                '**Regions**\n' +
                '`NA` • `EU` • `AS/AU` • `SA`\n\n' +

                '🔴 **Important:** You must have a registered profile before joining a waitlist.'
            )
            .setFooter({
                text: 'AsianTiers • Minecraft Tier Testing'
            })
            .setTimestamp();

        // -----------------------------------------
        // REGISTER BUTTON
        // -----------------------------------------

        const registerRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('register_profile')
                    .setLabel('Register / Update Profile')
                    .setStyle(ButtonStyle.Primary)
            );

        // -----------------------------------------
        // GAMEMODE BUTTONS
        // -----------------------------------------

        const row1 = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId('waitlist_nethpot')
                    .setLabel('NethPot')
                    .setEmoji(emojis.gamemodes.NethPot)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_mace')
                    .setLabel('Mace')
                    .setEmoji(emojis.gamemodes.Mace)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_sword')
                    .setLabel('Sword')
                    .setEmoji(emojis.gamemodes.Sword)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_axe')
                    .setLabel('Axe')
                    .setEmoji(emojis.gamemodes.Axe)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_crystal')
                    .setLabel('Crystal')
                    .setEmoji(emojis.gamemodes.Crystal)
                    .setStyle(ButtonStyle.Success)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId('waitlist_diapot')
                    .setLabel('DiaPot')
                    .setEmoji(emojis.gamemodes.DiaPot)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_smp')
                    .setLabel('SMP')
                    .setEmoji(emojis.gamemodes.SMP)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_uhc')
                    .setLabel('UHC')
                    .setEmoji(emojis.gamemodes.UHC)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_spearmace')
                    .setLabel('SpearMace')
                    .setEmoji(emojis.gamemodes.spearmace)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_diasmp')
                    .setLabel('Diamond SMP')
                    .setEmoji(emojis.gamemodes.diasmp)
                    .setStyle(ButtonStyle.Success)
            );

        const row3 = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId('waitlist_manhunt')
                    .setLabel('Manhunt')
                    .setEmoji(emojis.gamemodes.manhunt)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_shieldlessuhc')
                    .setLabel('ShieldLess UHC')
                    .setEmoji(emojis.gamemodes.shieldlessuhc)
                    .setStyle(ButtonStyle.Success)
            );

        // -----------------------------------------
        // SEND PANEL
        // -----------------------------------------

        await interaction.channel.send({
            embeds: [embed],
            components: [
                registerRow,
                row1,
                row2,
                row3
            ]
        });

        await interaction.reply({
            content: '<:tick:1567480091267825714> Waitlist panel sent.',
            ephemeral: true
        });
    }
};