
const { EmbedBuilder } = require('discord.js');
const supabase = require('../database/supabase');
const config = require('../config/config');

const GAMEMODES = [
    'Sword',
    'Mace',
    'NethPot',
    'Axe',
    'SMP',
    'UHC',
    'DiaPot',
    'Crystal',
    'spearmace',
    'diasmp',
    'manhunt',
    'shieldlessuhc',
    'cart'
];

module.exports = {
    name: 'messageCreate',

    async execute(message) {
        try {
            if (message.author.bot) return;
            if (!message.guild) return;

            const content = message.content.trim();
            const args = content.split(/\s+/);
            const command = args[0].toLowerCase();

            // Only handle: info @user and Tiers @user
            if (command !== 'info' && command !== 'tiers') return;

            const user = message.mentions.users.first();

            if (!user) {
                return message.reply({
                    content: `Usage: \`${args[0]} @username\``
                });
            }

            // ==========================================
            // TIERS COMMAND
            // ==========================================

            if (command === 'tiers') {
                const { data: player, error: playerError } =
                    await supabase
                        .from('players')
                        .select('discord_id, ign')
                        .eq('discord_id', user.id)
                        .maybeSingle();

                if (playerError) {
                    console.error('TIERS PROFILE ERROR:', playerError);

                    return message.reply({
                        content: 'Failed to fetch the player profile.'
                    });
                }

                if (!player) {
                    return message.reply({
                        content: `<@${user.id}> does not have a registered profile.`
                    });
                }

                // Fetch this player's actual test results.
                const { data: results, error: resultsError } =
                    await supabase
                        .from('results')
                        .select('gamemode, new_tier, created_at')
                        .eq('discord_id', user.id)
                        .order('created_at', { ascending: false });

                if (resultsError) {
                    console.error('TIERS RESULTS ERROR:', resultsError);

                    return message.reply({
                        content: 'Failed to fetch the player tiers.'
                    });
                }

                // Keep only the latest result for each tested gamemode.
                const latestTiers = new Map();

                for (const result of results || []) {
                    if (!result.gamemode || !result.new_tier) continue;

                    const mode = GAMEMODES.find(
                        item =>
                            item.toLowerCase() ===
                            result.gamemode.toLowerCase()
                    );

                    if (!mode || latestTiers.has(mode)) continue;

                    latestTiers.set(mode, result.new_tier);
                }

                if (latestTiers.size === 0) {
                    return message.reply({
                        content: `<@${user.id}> has no recorded test tiers yet.`
                    });
                }

                // Use only custom server emojis matching tier names.
                const getTierEmoji = (tier) => {
                    const emoji = message.guild.emojis.cache.find(
                        item =>
                            item.name.toLowerCase() === tier.toLowerCase()
                    );

                    return emoji ? `${emoji}` : '';
                };

                const lines = [];

                // Keep the display order consistent.
                for (const mode of GAMEMODES) {
                    if (!latestTiers.has(mode)) continue;

                    const tier = latestTiers.get(mode);
                    const emoji = getTierEmoji(tier);

                    const displayName =
                        config.gamemodeNames?.[mode] || mode;

                    lines.push(
                        `${displayName} — ${emoji ? `${emoji} ` : ''}**${tier}**`
                    );
                }

                const embed = new EmbedBuilder()
                    .setColor(config.colors.primary)
                    .setAuthor({
                        name: `${player.ign || user.username}'s Tiers`,
                        iconURL: user.displayAvatarURL()
                    })
                    .setDescription(lines.join('\n'))
                    .setFooter({
                        text: 'AsianTiers • Player Tiers'
                    });

                return message.reply({
                    embeds: [embed]
                });
            }

            // ==========================================
            // EXISTING INFO COMMAND
            // ==========================================

            const { data: player, error } = await supabase
                .from('players')
                .select('discord_id, ign, region, account_type')
                .eq('discord_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('INFO COMMAND DB ERROR:', error);

                return message.reply({
                    content: 'Failed to fetch player information.'
                });
            }

            if (!player) {
                return message.reply({
                    content: `<@${user.id}> does not have a registered profile.`
                });
            }

            const embed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle('Player Information')
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    {
                        name: 'IGN',
                        value: `\`${player.ign || 'Not set'}\``
                    },
                    {
                        name: 'Account Type',
                        value: `\`${player.account_type || 'Not set'}\``
                    },
                    {
                        name: 'Region',
                        value: `\`${player.region || 'Not set'}\``
                    }
                )
                .setFooter({
                    text: 'AsianTiers • Player Information'
                })
                .setTimestamp();

            return message.reply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('MESSAGE COMMAND ERROR:', error);

            return message.reply({
                content: 'Something went wrong while fetching player data.'
            }).catch(() => {});
        }
    }
};