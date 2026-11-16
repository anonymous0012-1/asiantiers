const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const roleConfig = require('../../utils/roleConfig');

const ALLOWED_USER_ID = '1105165947590938866';

function buildRoleSpecs() {
    const specs = [];
    let rank = 0;
    const add = (spec) => specs.push({ ...spec, rank: rank++ });

    // Restricted Role
    add({
        key: 'restricted',
        name: 'Restricted',
        category: 'Restricted'
    });

    // Registration Role
    add({
        key: 'registration',
        name: 'Registration',
        category: 'Registration'
    });

    // Waitlist Roles (one per supported gamemode)
    const gamemodes = config.gamemodes || [];
    gamemodes.forEach((gamemode) => {
        const displayName = config.gamemodeNames?.[gamemode] || gamemode;
        add({
            key: `waitlist_${gamemode}`,
            name: `${displayName} Waitlist`,
            category: 'Waitlist',
            gamemode
        });
    });

    return specs;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        )
    ]);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolecreate')
        .setDescription('Create and register only the configured waitlist, restricted, and registration roles')
        .setDefaultMemberPermissions(null),

    async execute(interaction) {
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

        const botMember = interaction.guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({
                content: '❌ I need the Manage Roles permission to create roles.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const specs = buildRoleSpecs();
        let discordRoles;
        try {
            discordRoles = await interaction.guild.roles.fetch();
        } catch (error) {
            console.error('ROLE CREATE - ROLE FETCH ERROR:', error);
            return interaction.editReply({
                content: '❌ Failed to fetch server roles.'
            });
        }

        let created = 0;
        let reused = 0;
        let failed = 0;
        const failures = [];

        for (const spec of specs) {
            console.log(`[RoleCreate] Processing role: ${spec.name}`);
            try {
                let role = discordRoles.find(r => r.name === spec.name);

                if (!role) {
                    console.log(`[RoleCreate] Creating role: ${spec.name}`);
                    role = await withTimeout(
                        interaction.guild.roles.create({
                            name: spec.name,
                            reason: 'AsianTiers role creation command'
                        }),
                        15000,
                        `create ${spec.name}`
                    );
                    discordRoles.set(role.id, role);
                    created++;
                    console.log(`[RoleCreate] Created role: ${spec.name} (${role.id})`);
                    await sleep(250);
                } else {
                    reused++;
                    console.log(`[RoleCreate] Reusing existing role: ${spec.name} (${role.id})`);
                }

                await withTimeout(
                    roleConfig.upsertRoleConfig(
                        spec.key,
                        spec.name,
                        spec.category,
                        spec.gamemode || null,
                        null,
                        role.id
                    ),
                    15000,
                    `save ${spec.name}`
                );
                console.log(`[RoleCreate] Saved role config: ${spec.name}`);
            } catch (error) {
                failed++;
                failures.push(`${spec.name}: ${error?.message || error}`);
                console.error('[RoleCreate] FAILED:', spec.name, error);
            }
        }

        roleConfig.clearRoleConfigCache();

        const summary = [
            'Role creation complete.',
            '',
            `Roles checked: ${specs.length}`,
            `Created: ${created}`,
            `Reused: ${reused}`,
            `Failed: ${failed}`
        ];

        if (failures.length > 0) {
            summary.push('', 'Failures:', failures.slice(0, 10).join('\n'));
            if (failures.length > 10) {
                summary.push(`...and ${failures.length - 10} more. Check bot logs.`);
            }
        }

        return interaction.editReply({
            content: summary.join('\n')
        });
    }
};