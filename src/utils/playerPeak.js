// Helpers for persisting per-gamemode Peak Tier and retirement data.
// All operations are best-effort and never throw; callers handle logging.

const supabase = require('../database/supabase');
const tierSystem = require('./tierSystem');

async function getPeakTiers(discordId) {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('peak_tiers')
            .eq('discord_id', discordId)
            .maybeSingle();

        if (error) throw error;
        const value = data?.peak_tiers;
        return (value && typeof value === 'object' && !Array.isArray(value))
            ? value
            : {};
    } catch (error) {
        console.error('GET PEAK TIERS ERROR:', error);
        return {};
    }
}

async function getPeakTier(discordId, gamemode) {
    const peakTiers = await getPeakTiers(discordId);
    const tier = peakTiers?.[gamemode];
    return tier ? tierSystem.normalizeTier(tier) : null;
}

async function setPeakTier(discordId, gamemode, peakTier) {
    const normalized = tierSystem.normalizeTier(peakTier);
    if (!normalized) return null;

    try {
        const peakTiers = await getPeakTiers(discordId);
        const current = peakTiers?.[gamemode]
            ? tierSystem.normalizeTier(peakTiers[gamemode])
            : null;

        // Never lower a saved peak tier.
        let finalPeak = normalized;
        if (current && tierSystem.isActiveTier(current) && tierSystem.isActiveTier(normalized)) {
            if (tierSystem.tierRank(normalized) <= tierSystem.tierRank(current)) {
                finalPeak = current;
            }
        } else if (current && tierSystem.isActiveTier(current)) {
            finalPeak = current;
        }

        const updated = { ...peakTiers, [gamemode]: finalPeak };

        const { error } = await supabase
            .from('players')
            .update({
                peak_tiers: updated,
                updated_at: new Date().toISOString()
            })
            .eq('discord_id', discordId);

        if (error) throw error;
        return finalPeak;
    } catch (error) {
        console.error('SET PEAK TIER ERROR:', error);
        return null;
    }
}

async function getRetiredTiers(discordId) {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('retired_tiers')
            .eq('discord_id', discordId)
            .maybeSingle();

        if (error) throw error;
        const value = data?.retired_tiers;
        return (value && typeof value === 'object' && !Array.isArray(value))
            ? value
            : {};
    } catch (error) {
        console.error('GET RETIRED TIERS ERROR:', error);
        return {};
    }
}

async function setRetiredTier(discordId, gamemode, retiredTier, retiredPoints) {
    const normalized = tierSystem.normalizeTier(retiredTier);
    if (!normalized) return null;

    try {
        const retiredTiers = await getRetiredTiers(discordId);
        const updated = { ...retiredTiers, [gamemode]: normalized };

        const payload = {
            retired_tiers: updated,
            updated_at: new Date().toISOString()
        };

        // Best-effort aggregate retired points (sum of per-gamemode retired points).
        try {
            const { data } = await supabase
                .from('players')
                .select('retired_points_by_gamemode')
                .eq('discord_id', discordId)
                .maybeSingle();

            const currentPoints =
                (data?.retired_points_by_gamemode &&
                    typeof data.retired_points_by_gamemode === 'object' &&
                    !Array.isArray(data.retired_points_by_gamemode))
                    ? data.retired_points_by_gamemode
                    : {};

            const updatedPoints = {
                ...currentPoints,
                [gamemode]: Number(retiredPoints) || 0
            };

            payload.retired_points_by_gamemode = updatedPoints;
        } catch (pointsError) {
            console.error('RETIRED POINTS READ ERROR:', pointsError);
        }

        const { error } = await supabase
            .from('players')
            .update(payload)
            .eq('discord_id', discordId);

        if (error) throw error;
        return normalized;
    } catch (error) {
        console.error('SET RETIRED TIER ERROR:', error);
        return null;
    }
}

module.exports = {
    getPeakTiers,
    getPeakTier,
    setPeakTier,
    getRetiredTiers,
    setRetiredTier
};
