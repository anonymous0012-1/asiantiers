
const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const roleConfig = require('../../utils/roleConfig');

const ALLOWED_USER_ID = '1105165947590938866';

const TIERS = [
    'LT5', 'HT5', 'LT4', 'HT4', 'LT3', 'HT3',
    'LT2', 'HT2', 'LT1', 'HT1',
    'RLT2', 'RHT2', 'RLT1', 'RHT1'
];

const TIER_COLORS = {
    HT1: 0xFFD700,
    LT1: 0xDAA520,
    HT2: 0xFF8C00,
    LT2: 0xCD853F,
    HT3: 0x2ECC71,
    LT3: 0x27AE60,
    HT4: 0x3498DB,
    LT4: 0x2980B9,
    HT5: 0x95A5A6,
    LT5: 0x7F8C8D,
    RHT2: 0x9B59B6,
    RLT2: 0x8E44AD,
    RHT1: 0x9B59B6,
    RLT1: 0x8E44AD
};

const GAMEMODE_TESTER_COLORS = [
    0xE74C3C,
    0x3498DB,
    0x2ECC71,
    0x9B59B6,
    0xF1C40F,
    0x1ABC9C,
    0xE67E22,
    0x34495E,
    0x16A085,
    0xC0392B,
    0x2980B9
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildRoleSpecs() {
    const specs = [];
    let rank = 0;

    const add = (spec) => {
        specs.push({
            ...spec,
            rank: rank++
        });
    };

    // MAIN ROLES
    add({
        key: 'owner',
        name: 'Owner',
        category: 'Main',
        color: 0x8B0000,
        hoist: true
    });

    add({
        key: 'overseas',
        name: 'Overseas',
        category: 'Main',
        color: 0x3498DB,
        hoist: false
    });

    // STAFF ROLES
    add({
        key: 'sr_mod',
        name: 'Sr. Mod',
        category: 'Staff',
        color: 0x9B59B6,
        hoist: false
    });

    add({
        key: 'moderator',
        name: 'Moderator',
        category: 'Staff',
        color: 0xE67E22,
        hoist: false
    });

    add({
        key: 'helper',
        name: 'Helper',
        category: 'Staff',
        color: 0x2ECC71,
        hoist: false
    });

    add({
        key: 'staff',
        name: 'Staff',
        category: 'Staff',
        color: 0xF1C40F,
        hoist: true
    });

    add({
        key: 'screensharer',
        name: 'Screensharer',
        category: 'Staff',
        color: 0x1ABC9C,
        hoist: false
    });

    add({
        key: 'high_result_manager',
        name: 'High Result Manager',
        category: 'Staff',
        color: 0xFF69B4,
        hoist: false
    });

    add({
        key: 'retire_result_manager',
        name: 'Retire Result Manager',
        category: 'Staff',
        color: 0x8E44AD,
        hoist: false
    });

    add({
        key: 'developer',
        name: 'Developer',
        category: 'Staff',
        color: 0x2C3E50,
        hoist: false
    });

    // PRIORITY ROLES
    add({
        key: 'booster',
        name: 'Booster',
        category: 'Priority',
        color: 0xE91E63,
        hoist: false
    });

    add({
        key: 'vip',
        name: 'VIP',
        category: 'Priority',
        color: 0xF1C40F,
        hoist: false
    });

    // TESTER ROLE
    add({
        key: 'tester',
        name: 'Tester',
        category: 'Testing',
        color: 0xE74C3C,
        hoist: true
    });

    const gamemodes = Object.keys(config.tiers || {});

    // GAMEMODE-SPECIFIC TESTER ROLES
    gamemodes.forEach((gamemode, index) => {
        const displayName =
            config.gamemodeNames?.[gamemode] || gamemode;

        add({
            key: `tester_gamemode_${gamemode}`,
            name: `${displayName} Tester`,
            category: 'Testing',
            color: GAMEMODE_TESTER_COLORS[
                index % GAMEMODE_TESTER_COLORS.length
            ],
            hoist: false,
            gamemode
        });
    });

    // SPECIAL ROLES
    add({
        key: 'tester_of_the_month',
        name: 'Tester of the Month',
        category: 'Special',
        color: 0xFFD700,
        hoist: false
    });

    // TIER ROLES
    gamemodes.forEach(gamemode => {
        const displayName =
            config.gamemodeNames?.[gamemode] || gamemode;

        for (const tier of TIERS) {
            add({
                key: `tier_${gamemode}_${tier}`,
                name: `${displayName} | ${tier}`,
                category: 'Tier',
                color: TIER_COLORS[tier] || 0x95A5A6,
                hoist: false,
                gamemode,
                tier
            });
        }
    });

    return specs;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setuproles')
        .setDescription('Automatically create and organize all server roles')
        .setDefaultMemberPermissions(null),

    async execute(interaction) {

        // USER ID ACCESS RESTRICTION
        if (interaction.user.id !== ALLOWED_USER_ID) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral
            });
        }

        // BOT PERMISSION CHECK
        const botMember = interaction.guild.members.me;

        if (!botMember?.permissions?.has(
            PermissionFlagsBits.ManageRoles
        )) {
            return interaction.reply({
                content: '❌ I need the Manage Roles permission.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        const specs = buildRoleSpecs();

        let discordRoles;

        try {
            discordRoles = await interaction.guild.roles.fetch();
        } catch (error) {
            console.error('SETUP ROLES FETCH ERROR:', error);

            return interaction.editReply({
                content: '❌ Failed to fetch server roles.'
            });
        }

        // FETCH DATABASE MAPPINGS
        let dbMappings;

        try {
            const { data, error } = await supabase
                .from('kairo_role_configs')
                .select('role_key, role_id')
                .eq('guild_id', interaction.guild.id);

            if (error) throw error;

            dbMappings = data || [];
        } catch (error) {
            console.error('SETUP ROLES DB ERROR:', error);

            return interaction.editReply({
                content: '❌ Failed to read role mappings from Supabase.'
            });
        }

        const dbMap = {};

        for (const row of dbMappings) {
            if (row?.role_key) {
                dbMap[row.role_key] = row.role_id;
            }
        }

        let created = 0;
        let reused = 0;
        let updated = 0;
        let failed = 0;

        const failures = [];
        const roleObjects = {};

        // CREATE / REUSE / UPDATE ROLES
        for (const spec of specs) {
            try {
                let role = null;

                // 1. CHECK DATABASE MAPPING
                if (dbMap[spec.key]) {
                    role =
                        discordRoles.get(dbMap[spec.key]) ||
                        await interaction.guild.roles
                            .fetch(dbMap[spec.key])
                            .catch(() => null);
                }

                // 2. CHECK EXISTING ROLE BY NAME
                if (!role) {
                    role = discordRoles.find(
                        r => r.name === spec.name
                    );
                }

                // 3. CREATE MISSING ROLE
                if (!role) {
                    role = await interaction.guild.roles.create({
                        name: spec.name,
                        color: spec.color,
                        hoist: spec.hoist,
                        mentionable: false,
                        reason: 'KairoTiers automatic role setup'
                    });

                    discordRoles.set(role.id, role);
                    created++;
                } else {
                    reused++;

                    // UPDATE EXISTING ROLE SETTINGS
                    try {
                        await role.edit({
                            name: spec.name,
                            color: spec.color,
                            hoist: spec.hoist,
                            mentionable: false
                        }, 'KairoTiers role setup update');

                        updated++;

                        // Refresh role object after editing
                        role = await interaction.guild.roles.fetch(role.id);
                    } catch (editError) {
                        console.error(
                            'ROLE EDIT ERROR:',
                            spec.key,
                            editError
                        );
                    }
                }

                roleObjects[spec.key] = role;

                // SAVE ROLE CONFIGURATION
                const { error: saveError } = await supabase
                    .from('kairo_role_configs')
                    .upsert({
                        guild_id: interaction.guild.id,
                        role_key: spec.key,
                        role_name: spec.name,
                        role_id: role.id,
                        category: spec.category,
                        gamemode: spec.gamemode || null,
                        tier: spec.tier || null,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'guild_id,role_key'
                    });

                if (saveError) throw saveError;

                dbMap[spec.key] = role.id;

                await sleep(150);

            } catch (error) {
                failed++;

                failures.push(
                    `${spec.name}: ${error?.message || error}`
                );

                console.error(
                    'SETUP ROLE FAILED:',
                    spec.name,
                    error
                );
            }
        }

        // HIERARCHY SETUP
        try {
            const managed = specs
                .map(spec => ({
                    spec,
                    role: roleObjects[spec.key]
                }))
                .filter(item => item.role)
                .sort((a, b) => a.spec.rank - b.spec.rank);

            let position = managed.length + 5;

            for (const item of managed) {
                try {
                    await item.role.setPosition(position);
                    position--;

                    await sleep(100);
                } catch (posError) {
                    console.error(
                        'POSITION ERROR:',
                        item.spec.key,
                        posError
                    );
                }
            }

        } catch (error) {
            console.error('HIERARCHY ERROR:', error);
        }

        // CLEAR ROLE CONFIG CACHE
        roleConfig.clearRoleConfigCache();

        const summary = [
            '✅ **KairoTiers Role Setup Complete!**',
            '',
            `**Created:** ${created}`,
            `**Reused:** ${reused}`,
            `**Settings Updated:** ${updated}`,
            `**Failed:** ${failed}`,
            `**Total Managed Roles:** ${specs.length}`,
            '',
            `**Gamemodes:** ${Object.keys(config.tiers || {}).length}`,
            `**Tiers Per Gamemode:** ${TIERS.length}`
        ];

        if (failures.length > 0) {
            summary.push(
                '',
                '**Failures:**',
                failures.slice(0, 10).join('\n')
            );

            if (failures.length > 10) {
                summary.push(
                    `...and ${failures.length - 10} more. Check bot logs.`
                );
            }
        }

        return interaction.editReply({
            content: summary.join('\n')
        });
    }
};
