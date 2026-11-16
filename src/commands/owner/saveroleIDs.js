const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');

const config = require('../../config/config');
const supabase = require('../../database/supabase');
const roleConfig = require('../../utils/roleConfig');

const ALLOWED_USER_ID = '1105165947590938866';

const TIERS = [
    'LT2', 'HT2', 'LT1', 'HT1',
    'RLT5', 'RHT5', 'RLT4', 'RHT4', 'RLT3', 'RHT3',
    'RLT2', 'RHT2', 'RLT1', 'RHT1'
];

function buildRoleSpecs() {
    const specs = [];
    let rank = 0;
    const add = (spec) => specs.push({ ...spec, rank: rank++ });

    add({ key: 'owner', name: 'Owner', category: 'Main' });
    add({ key: 'overseas', name: 'Overseas', category: 'Main' });

    
    add({ key: 'sr_mod', name: 'Sr. Mod', category: 'Staff' });
    add({ key: 'moderator', name: 'Moderator', category: 'Staff' });
    add({ key: 'helper', name: 'Helper', category: 'Staff' });
    add({ key: 'staff', name: 'Staff', category: 'Staff' });
    add({ key: 'screensharer', name: 'Screensharer', category: 'Staff' });
    add({ key: 'high_result_manager', name: 'High Result Manager', category: 'Staff' });
    add({ key: 'retire_result_manager', name: 'Retire Result Manager', category: 'Staff' });
    add({ key: 'developer', name: 'Developer', category: 'Staff' });

    // Priority
    add({ key: 'booster', name: 'Booster', category: 'Priority' });
    add({ key: 'vip', name: 'VIP', category: 'Priority' });

    // Testing
    add({ key: 'tester', name: 'Tester', category: 'Testing' });

    const gamemodes = config.gamemodes || [];
    gamemodes.forEach((gamemode) => {
        const displayName = config.gamemodeNames?.[gamemode] || gamemode;
        add({
            key: `tester_gamemode_${gamemode}`,
            name: `${displayName} Tester`,
            category: 'Testing',
            gamemode
        });
    });

    // Special
    add({ key: 'tester_of_the_month', name: 'Tester of the Month', category: 'Special' });

    // Restricted Role
    add({ key: 'restricted', name: 'Restricted', category: 'Restricted' });

    // Registration Role
    add({ key: 'registration', name: 'Registration', category: 'Registration' });

    // Waitlist Roles
    gamemodes.forEach((gamemode) => {
        const displayName = config.gamemodeNames?.[gamemode] || gamemode;
        add({
            key: `waitlist_${gamemode}`,
            name: `${displayName} Waitlist`,
            category: 'Waitlist',
            gamemode
        });
    });

    // Tier roles
    gamemodes.forEach((gamemode) => {
        const displayName = config.gamemodeNames?.[gamemode] || gamemode;
        for (const tier of TIERS) {
            add({
                key: `tier_${gamemode}_${tier}`,
                name: `${displayName} | ${tier}`,
                category: 'Tier',
                gamemode,
                tier
            });
        }
    });

    return specs;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saveroleids')
        .setDescription('Save IDs of existing Discord roles without modifying them')
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

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const specs = buildRoleSpecs();
        const discordRoles = await interaction.guild.roles.fetch();

        let matched = 0;
        let saved = 0;
        let missing = 0;
        const missingNames = [];
        const saveErrors = [];

        for (const spec of specs) {
            const role = discordRoles.find(r => r.name === spec.name);
            if (!role) {
                missing++;
                missingNames.push(spec.name);
                continue;
            }

            matched++;

            try {
                await roleConfig.upsertRoleConfig(
                    spec.key,
                    spec.name,
                    spec.category,
                    spec.gamemode || null,
                    spec.tier || null,
                    role.id
                );
                saved++;
            } catch (error) {
                saveErrors.push(`${spec.name}: ${error?.message || error}`);
                console.error('SAVE ROLE ID ERROR:', spec.name, error);
            }
        }

        roleConfig.clearRoleConfigCache();

        const summary = [
            '✅ Save Role IDs complete.',
            '',
            `Total roles in server: ${discordRoles.size}`,
            `Role specs checked: ${specs.length}`,
            `Matched: ${matched}`,
            `Saved: ${saved}`,
            `Missing/unmatched: ${missing}`
        ];

        if (missingNames.length > 0) {
            summary.push('', 'Missing roles:', missingNames.slice(0, 25).join('\n'));
            if (missingNames.length > 25) {
                summary.push(`...and ${missingNames.length - 25} more.`);
            }
        }

        if (saveErrors.length > 0) {
            summary.push('', 'Supabase errors:', saveErrors.slice(0, 15).join('\n'));
        }

        return interaction.editReply({ content: summary.join('\n') });
    }
};