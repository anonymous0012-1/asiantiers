const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const roleConfig = require('../../utils/roleConfig');

const GAMEMODE = 'Speed';
const DISPLAY_NAME = config.gamemodeNames?.[GAMEMODE] || GAMEMODE;

const NORMAL_TIERS = [
    'LT5', 'HT5',
    'LT4', 'HT4',
    'LT3', 'HT3',
    'LT2', 'HT2',
    'LT1', 'HT1'
];

const RETIRED_TIERS = [
    'RLT5', 'RHT5',
    'RLT4', 'RHT4',
    'RLT3', 'RHT3',
    'RLT2', 'RHT2',
    'RLT1', 'RHT1'
];

const ALL_TIERS = [...NORMAL_TIERS, ...RETIRED_TIERS];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function findOrCreateRole(guild, discordRoles, name, preferredId) {
    if (preferredId) {
        const existing =
            discordRoles.get(preferredId) ||
            await guild.roles.fetch(preferredId).catch(() => null);
        if (existing) {
            discordRoles.set(existing.id, existing);
            return { role: existing, status: 'reused' };
        }
    }

    const byName = discordRoles.find(role => role.name === name);
    if (byName) {
        discordRoles.set(byName.id, byName);
        return { role: byName, status: 'reused' };
    }

    const newRole = await guild.roles.create({
        name,
        reason: 'KairoTiers Speed gamemode setup'
    });

    discordRoles.set(newRole.id, newRole);
    await sleep(250);
    return { role: newRole, status: 'created' };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupspeed')
        .setDescription('Automatically create and register all Speed gamemode roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (interaction.user.id !== '1105165947590938866') {
            return interaction.reply({
                content: '<:crosss:1570104768628531290> You do not have permission to use this command.',
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
                content: '<:crosss:1570104768628531290> I need the Manage Roles permission to create roles.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Fetch Discord roles.
        let discordRoles;
        try {
            discordRoles = await interaction.guild.roles.fetch();
        } catch (error) {
            console.error('SETUPSPEED ROLE FETCH ERROR:', error);
            return interaction.editReply({
                content: '<:crosss:1570104768628531290> Failed to fetch server roles.'
            });
        }

        // Fetch existing DB mappings.
        let tierDbMappings = [];
        let kairoMappings = [];
        try {
            const { data, error } = await supabase
                .from('tier_roles')
                .select('gamemode, tier, role_id')
                .eq('gamemode', GAMEMODE);
            if (error) throw error;
            tierDbMappings = data || [];
        } catch (error) {
            console.error('SETUPSPEED TIER DB FETCH ERROR:', error);
        }

        try {
            const { data, error } = await supabase
                .from('kairo_role_configs')
                .select('role_key, role_id');
            if (error) throw error;
            kairoMappings = data || [];
        } catch (error) {
            console.error('SETUPSPEED KAIRO DB FETCH ERROR:', error);
        }

        const findKairo = (key) =>
            kairoMappings.find(row => row.role_key === key);

        const saveTierMapping = async (tier, roleId) => {
            const existing = tierDbMappings.find(
                row => row.gamemode === GAMEMODE && row.tier === tier
            );

            if (existing) {
                const { error } = await supabase
                    .from('tier_roles')
                    .update({ role_id: roleId })
                    .eq('gamemode', GAMEMODE)
                    .eq('tier', tier);
                if (error) throw error;
                existing.role_id = roleId;
            } else {
                const { data, error } = await supabase
                    .from('tier_roles')
                    .insert({ gamemode: GAMEMODE, tier, role_id: roleId })
                    .select()
                    .single();
                if (error) throw error;
                tierDbMappings.push(data || { gamemode: GAMEMODE, tier, role_id: roleId });
            }
        };

        const saveKairoMapping = async (roleKey, roleName, category, tier, roleId) => {
            const { error } = await supabase
                .from('kairo_role_configs')
                .upsert({
                    role_key: roleKey,
                    role_name: roleName,
                    category,
                    gamemode: GAMEMODE,
                    tier: tier || null,
                    role_id: roleId,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'role_key' });

            if (error) throw error;

            const existing = findKairo(roleKey);
            if (existing) existing.role_id = roleId;
            else kairoMappings.push({ role_key: roleKey, role_id: roleId });
        };

        let created = 0;
        let reused = 0;
        let failed = 0;
        const failures = [];

        const total = ALL_TIERS.length + 2; // tiers + tester + waitlist
        let processed = 0;

        // -----------------------------------------
        // TIER ROLES
        // -----------------------------------------
        for (const tier of ALL_TIERS) {
            processed++;
            const roleName = `${DISPLAY_NAME} | ${tier}`;
            const dbMapping = tierDbMappings.find(
                row => row.gamemode === GAMEMODE && row.tier === tier
            );
            const kairoKey = `tier_${GAMEMODE}_${tier}`;
            const kairoMapping = findKairo(kairoKey);

            try {
                const { role, status } = await findOrCreateRole(
                    interaction.guild,
                    discordRoles,
                    roleName,
                    dbMapping?.role_id || kairoMapping?.role_id
                );

                await saveTierMapping(tier, role.id);
                await saveKairoMapping(kairoKey, roleName, 'Tier', tier, role.id);

                if (status === 'created') created++;
                else reused++;
            } catch (error) {
                failed++;
                failures.push(`${roleName}: ${error?.message || error}`);
                console.error('SETUPSPEED TIER ROLE FAILED:', roleName, error);
            }

            if (processed % 5 === 0 || processed === total) {
                await interaction.editReply({
                    content:
                        `Setting up Speed roles...\n` +
                        `Progress: ${processed}/${total}\n` +
                        `Created: ${created} | Reused: ${reused} | Failed: ${failed}`
                }).catch(() => {});
            }
        }

        // -----------------------------------------
        // SPEED TESTER ROLE
        // -----------------------------------------
        processed++;
        const testerRoleName = `${GAMEMODE} Tester`;
        const testerKairoKey = `tester_gamemode_${GAMEMODE}`;
        const testerKairoMapping = findKairo(testerKairoKey);

        try {
            const { role, status } = await findOrCreateRole(
                interaction.guild,
                discordRoles,
                testerRoleName,
                testerKairoMapping?.role_id
            );

            await saveKairoMapping(testerKairoKey, testerRoleName, 'Tester', null, role.id);

            if (status === 'created') created++;
            else reused++;
        } catch (error) {
            failed++;
            failures.push(`${testerRoleName}: ${error?.message || error}`);
            console.error('SETUPSPEED TESTER ROLE FAILED:', error);
        }

        // -----------------------------------------
        // SPEED WAITLIST ROLE
        // -----------------------------------------
        processed++;
        const waitlistRoleName = `${GAMEMODE} Waitlist`;
        const waitlistKairoKey = `waitlist_${GAMEMODE}`;
        const waitlistKairoMapping = findKairo(waitlistKairoKey);

        try {
            const { role, status } = await findOrCreateRole(
                interaction.guild,
                discordRoles,
                waitlistRoleName,
                waitlistKairoMapping?.role_id
            );

            await saveKairoMapping(waitlistKairoKey, waitlistRoleName, 'Waitlist', null, role.id);

            if (status === 'created') created++;
            else reused++;
        } catch (error) {
            failed++;
            failures.push(`${waitlistRoleName}: ${error?.message || error}`);
            console.error('SETUPSPEED WAITLIST ROLE FAILED:', error);
        }

        roleConfig.clearRoleConfigCache();

        const summaryLines = [
            'Speed role setup complete.',
            '',
            `Gamemode: ${GAMEMODE}`,
            `Tier roles: ${ALL_TIERS.length}`,
            `Tester role: 1`,
            `Waitlist role: 1`,
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