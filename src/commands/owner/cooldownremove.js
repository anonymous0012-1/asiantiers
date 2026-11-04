const {
    SlashCommandBuilder
} = require('discord.js');

const supabase = require('../../database/supabase');
const perms = require('../../utils/permissions');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('cooldownremove')
        .setDescription('Removes a player testing cooldown')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The player')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('gamemode')
                .setDescription('Gamemode')
                .setRequired(true)
                .addChoices(
                    { name: 'Sword', value: 'Sword' },
                    { name: 'Mace', value: 'Mace' },
                    { name: 'Axe', value: 'Axe' },
                    { name: 'Crystal', value: 'Crystal' },
                    { name: 'NethPot', value: 'NethPot' },
                    { name: 'DiaPot', value: 'DiaPot' },
                    { name: 'SMP', value: 'SMP' },
                    { name: 'UHC', value: 'UHC' }
                )
        ),

    async execute(interaction) {

        if (!perms.isTester(interaction.member)) {

            return interaction.reply({
                content: '<:crosss:1567480131713241108> Only testers can use this command.',
                flags: 64
            });
        }

        const user =
            interaction.options.getUser('user');

        const gamemode =
            interaction.options.getString('gamemode');

        await interaction.deferReply({
            flags: 64
        });

        try {

            const { data: cooldown, error: findError } =
                await supabase
                    .from('testing_cooldowns')
                    .select('*')
                    .eq('discord_id', user.id)
                    .eq('gamemode', gamemode)
                    .maybeSingle();

            if (findError) {

                console.error(
                    'COOLDOWN FIND ERROR:',
                    findError
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Failed to check the player cooldown.'
                });
            }

            if (!cooldown) {

                return interaction.editReply({
                    content:
                        `ℹ️ <@${user.id}> does not have a **${gamemode}** cooldown.`
                });
            }

            const { error: deleteError } =
                await supabase
                    .from('testing_cooldowns')
                    .delete()
                    .eq('discord_id', user.id)
                    .eq('gamemode', gamemode);

            if (deleteError) {

                console.error(
                    'COOLDOWN REMOVE ERROR:',
                    deleteError
                );

                return interaction.editReply({
                    content:
                        '<:crosss:1567480131713241108> Failed to remove the cooldown.'
                });
            }

            return interaction.editReply({
                content:
                    `<:tick:1567480091267825714> Removed the **${gamemode}** testing cooldown from <@${user.id}>.`
            });

        } catch (error) {

            console.error(
                'COOLDOWN REMOVE COMMAND ERROR:',
                error
            );

            return interaction.editReply({
                content:
                    '<:crosss:1567480131713241108> Something went wrong while removing the cooldown.'
            }).catch(() => {});
        }
    }
};