const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');

const NEW_TIERS = [
    'LT2',
    'HT2',
    'LT1',
    'HT1',
    'RLT2',
    'RHT2',
    'RLT1',
    'RHT1'
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuptierroles')
        .setDescription('Automatically create and register all additional tier roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> Only administrators can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (!interaction.guild) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        const botMember = interaction.guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> I need the Manage Roles permission to create tier roles.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const gamemodes = Object.keys(config.tiers || {});

        let created = 0;
        let reused = 0;
        let failed = 0;
        const failures = [];

        // Fetch all Discord roles once.
        let discordRoles;
        try {
            discordRoles = await interaction.guild.roles.fetch();
        } catch (error) {
            console.error('SETUP TIER ROLES - ROLE FETCH ERROR:', error);
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Failed to fetch server roles.'
            });
        }

        // Fetch existing DB mappings once.
        let dbMappings = [];
        try {
            const { data, error } = await supabase
                .from('tier_roles')
                .select('gamemode, tier, role_id');

            if (error) throw error;
            dbMappings = data || [];
        } catch (error) {
            console.error('SETUP TIER ROLES - DB FETCH ERROR:', error);
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Failed to read tier role mappings from the database.'
            });
        }

        const findDbMapping = (gamemode, tier) =>
            dbMappings.find(row => row.gamemode === gamemode && row.tier === tier);

        const saveDbMapping = async (gamemode, tier, roleId) => {
            const existing = findDbMapping(gamemode, tier);

            if (existing) {
                const { error } = await supabase
                    .from('tier_roles')
                    .update({ role_id: roleId })
                    .eq('gamemode', gamemode)
                    .eq('tier', tier);

                if (error) throw error;

                existing.role_id = roleId;
            } else {
                const { data, error } = await supabase
                    .from('tier_roles')
                    .insert({
                        gamemode,
                        tier,
                        role_id: roleId
                    })
                    .select()
                    .single();

                if (error) throw error;
                dbMappings.push(data || { gamemode, tier, role_id: roleId });
            }
        };

        const total = gamemodes.length * NEW_TIERS.length;
        let processed = 0;

        for (const gamemode of gamemodes) {
            const displayName =
                config.gamemodeNames?.[gamemode] || gamemode;

            for (const tier of NEW_TIERS) {
                processed++;
                const roleName = `${displayName} | ${tier}`;
                let roleId = null;
                let status = 'failed';

                try {
                    const dbMapping = findDbMapping(gamemode, tier);

                    // 1. Verify existing database mapping first.
                    if (dbMapping?.role_id) {
                        const existingRole =
                            discordRoles.get(dbMapping.role_id) ||
                            await interaction.guild.roles.fetch(dbMapping.role_id).catch(() => null);

                        if (existingRole) {
                            roleId = existingRole.id;
                            status = 'reused';
                        }
                    }

                    // 2. If no valid DB mapping, look for a matching Discord role by name.
                    if (!roleId) {
                        const byName = discordRoles.find(role => role.name === roleName);
                        if (byName) {
                            roleId = byName.id;
                            status = 'reused';
                        }
                    }

                    // 3. Create the role if it is still missing.
                    if (!roleId) {
                        const newRole = await interaction.guild.roles.create({
                            name: roleName,
                            reason: 'KairoTiers automatic tier role setup'
                        });

                        discordRoles.set(newRole.id, newRole);
                        roleId = newRole.id;
                        status = 'created';

                        // Small delay to reduce role-creation rate-limit pressure.
                        await sleep(250);
                    }

                    // 4. Save or update the mapping in Supabase.
                    await saveDbMapping(gamemode, tier, roleId);

                    if (status === 'created') created++;
                    else if (status === 'reused') reused++;

                } catch (error) {
                    failed++;
                    const reason =
                        error?.message || String(error);
                    failures.push(`${roleName}: ${reason}`);
                    console.error('SETUP TIER ROLE FAILED:', roleName, error);
                }

                // Progress update.
                if (processed % 10 === 0 || processed === total) {
                    await interaction.editReply({
                        content:
                            `Setting up tier roles...\n` +
                            `Progress: ${processed}/${total}\n` +
                            `Created: ${created} | Reused: ${reused} | Failed: ${failed}`
                    }).catch(() => {});
                }
            }
        }

        const summaryLines = [
            'Tier role setup complete.',
            '',
            `Gamemodes: ${gamemodes.length}`,
            `Tiers per gamemode: ${NEW_TIERS.length}`,
            `Total roles: ${total}`,
            `Created: ${created}`,
            `Reused: ${reused}`,
            `Failed: ${failed}`
        ];

        if (failures.length > 0) {
            const preview = failures.slice(0, 10).join('\n');
            summaryLines.push('', 'Failures:', preview);
            if (failures.length > 10) {
                summaryLines.push(`...and ${failures.length - 10} more. Check bot logs.`);
            }
        }

        return interaction.editReply({
            content: summaryLines.join('\n')
        });
    }
};