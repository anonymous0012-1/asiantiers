const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const config = require('../../config/config');
const supabase = require('../../database/supabase');
const roleConfig = require('../../utils/roleConfig');

const TIERS = [
    'LT5', 'HT5', 'LT4', 'HT4', 'LT3', 'HT3',
    'LT2', 'HT2', 'LT1', 'HT1',
    'RLT2', 'RHT2', 'RLT1', 'RHT1'
];

const TIER_COLORS = {
    HT1: 0xFFD700, LT1: 0xDAA520,
    HT2: 0xFF8C00, LT2: 0xCD853F,
    HT3: 0x2ECC71, LT3: 0x27AE60,
    HT4: 0x3498DB, LT4: 0x2980B9,
    HT5: 0x95A5A6, LT5: 0x7F8C8D,
    RHT2: 0x9B59B6, RLT2: 0x8E44AD,
    RHT1: 0x9B59B6, RLT1: 0x8E44AD
};

const GAMEMODE_TESTER_COLORS = [
    0xE74C3C, 0x3498DB, 0x2ECC71, 0x9B59B6, 0xF1C40F,
    0x1ABC9C, 0xE67E22, 0x34495E, 0x16A085, 0xC0392B, 0x2980B9
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildRoleSpecs() {
    const specs = [];
    let rank = 0;

    const add = (spec) => {
        specs.push({ ...spec, rank: rank++ });
    };

    // Main
    add({ key: 'owner', name: 'Owner', category: 'Main', color: 0x8B0000, hoist: true });
    add({ key: 'overseas', name: 'Overseas', category: 'Main', color: 0x3498DB, hoist: false });

    // Staff
    add({ key: 'sr_mod', name: 'Sr. Mod', category: 'Staff', color: 0x9B59B6, hoist: false });
    add({ key: 'moderator', name: 'Moderator', category: 'Staff', color: 0xE67E22, hoist: false });
    add({ key: 'helper', name: 'Helper', category: 'Staff', color: 0x2ECC71, hoist: false });
    add({ key: 'staff', name: 'Staff', category: 'Staff', color: 0xF1C40F, hoist: true });
    add({ key: 'screensharer', name: 'Screensharer', category: 'Staff', color: 0x1ABC9C, hoist: false });
    add({ key: 'high_result_manager', name: 'High Result Manager', category: 'Staff', color: 0xFF69B4, hoist: false });
    add({ key: 'retire_result_manager', name: 'Retire Result Manager', category: 'Staff', color: 0x8E44AD, hoist: false });
    add({ key: 'developer', name: 'Developer', category: 'Staff', color: 0x2C3E50, hoist: false });

    // Priority
    add({ key: 'booster', name: 'Booster', category: 'Priority', color: 0xE91E63, hoist: false });
    add({ key: 'vip', name: 'VIP', category: 'Priority', color: 0xF1C40F, hoist: false });

    // Testing
    add({ key: 'tester', name: 'Tester', category: 'Testing', color: 0xE74C3C, hoist: true });

    const gamemodes = Object.keys(config.tiers || {});
    gamemodes.forEach((gamemode, index) => {
        const displayName = config.gamemodeNames?.[gamemode] || gamemode;
        add({
            key: `tester_gamemode_${gamemode}`,
            name: `${displayName} Tester`,
            category: 'Testing',
            color: GAMEMODE_TESTER_COLORS[index % GAMEMODE_TESTER_COLORS.length],
            hoist: false,
            gamemode
        });
    });

    // Special
    add({ key: 'tester_of_the_month', name: 'Tester of the Month', category: 'Special', color: 0xFFD700, hoist: false });

    // Tier roles
    gamemodes.forEach((gamemode) => {
        const displayName = config.gamemodeNames?.[gamemode] || gamemode;
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.member?.roles?.cache?.has('1105165947590938866')) {
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

        const botMember = interaction.guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: '❌ I need the Manage Roles permission.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const specs = buildRoleSpecs();
        const discordRoles = await interaction.guild.roles.fetch();
        const { data: dbMappings } = await supabase
            .from('kairo_role_configs')
            .select('role_key, role_id');

        const dbMap = {};
        for (const row of dbMappings || []) {
            if (row?.role_key) dbMap[row.role_key] = row.role_id;
        }

        let created = 0;
        let reused = 0;
        let updated = 0;
        let failed = 0;
        const failures = [];
        const roleObjects = {};

        for (const spec of specs) {
            try {
                let role = null;

                // 1. DB mapping
                if (dbMap[spec.key]) {
                    role = discordRoles.get(dbMap[spec.key]) ||
                        await interaction.guild.roles.fetch(dbMap[spec.key]).catch(() => null);
                }

                // 2. By name
                if (!role) {
                    role = discordRoles.find(r => r.name === spec.name);
                }

                if (!role) {
                    role = await interaction.guild.roles.create({
                        name: spec.name,
                        color: spec.color,
                        hoist: spec.hoist,
                        mentionable: false,
                        reason: 'AsianTiers automatic role setup'
                    });
                    discordRoles.set(role.id, role);
                    created++;
                } else {
                    reused++;
                    // Update settings
                    try {
                        await role.edit({
                            name: spec.name,
                            color: spec.color,
                            hoist: spec.hoist,
                            mentionable: false
                        }, 'AsianTiers role setup update');
                        updated++;
                    } catch (editError) {
                        console.error('ROLE EDIT ERROR:', spec.key, editError);
                    }
                }

                roleObjects[spec.key] = role;

                await roleConfig.upsertRoleConfig(
                    spec.key,
                    spec.name,
                    spec.category,
                    spec.gamemode || null,
                    spec.tier || null,
                    role.id
                );
                dbMap[spec.key] = role.id;

                await sleep(150);
            } catch (error) {
                failed++;
                failures.push(`${spec.name}: ${error?.message || error}`);
                console.error('SETUP ROLE FAILED:', spec.name, error);
            }
        }

        // Hierarchy: set positions (best effort)
        try {
            const managed = specs
                .map(spec => ({ spec, role: roleObjects[spec.key] }))
                .filter(item => item.role)
                .sort((a, b) => a.spec.rank - b.spec.rank);

            // Higher rank => higher position. Set from top down.
            let position = managed.length + 5;
            for (const item of managed) {
                try {
                    await item.role.setPosition(position);
                    position--;
                    await sleep(100);
                } catch (posError) {
                    console.error('POSITION ERROR:', item.spec.key, posError);
                }
            }
        } catch (error) {
            console.error('HIERARCHY ERROR:', error);
        }

        roleConfig.clearRoleConfigCache();

        const summary = [
            '✅ Role setup complete.',
            '',
            `Created: ${created}`,
            `Reused/Updated: ${reused}`,
            `Settings updated: ${updated}`,
            `Failed: ${failed}`,
            `Total managed roles: ${specs.length}`
        ];

        if (failures.length > 0) {
            summary.push('', 'Failures:', failures.slice(0, 10).join('\n'));
            if (failures.length > 10) {
                summary.push(`...and ${failures.length - 10} more.`);
            }
        }

        return interaction.editReply({ content: summary.join('\n') });
    }
};
