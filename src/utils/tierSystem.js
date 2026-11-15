// Centralized tier ordering, points, and peak/retired tier helpers.
// AsianTiers (not KairoTiers).

const ACTIVE_TIERS = [
    'LT5', 'HT5',
    'LT4', 'HT4',
    'LT3', 'HT3',
    'LT2', 'HT2',
    'LT1', 'HT1'
];

const TIER_POINTS = {
    HT1: 60,
    LT1: 45,
    HT2: 30,
    LT2: 20,
    HT3: 10,
    LT3: 6,
    HT4: 4,
    LT4: 3,
    HT5: 2,
    LT5: 1
};

const TIER_RANK = {};
ACTIVE_TIERS.forEach((tier, index) => {
    TIER_RANK[tier] = index;
});

const RETIRED_TIER_MAP = {
    LT5: 'RLT5',
    HT5: 'RHT5',
    LT4: 'RLT4',
    HT4: 'RHT4',
    LT3: 'RLT3',
    HT3: 'RHT3',
    LT2: 'RLT2',
    HT2: 'RHT2',
    LT1: 'RLT1',
    HT1: 'RHT1'
};

function normalizeTier(tier) {
    if (tier === null || tier === undefined) return null;
    return String(tier).trim().toUpperCase();
}

function isActiveTier(tier) {
    const normalized = normalizeTier(tier);
    return ACTIVE_TIERS.includes(normalized);
}

function isRetiredTier(tier) {
    const normalized = normalizeTier(tier);
    if (!normalized) return false;
    return Object.values(RETIRED_TIER_MAP).includes(normalized);
}

function tierRank(tier) {
    const normalized = normalizeTier(tier);
    if (!Object.prototype.hasOwnProperty.call(TIER_RANK, normalized)) {
        return -1;
    }
    return TIER_RANK[normalized];
}

function isHigherTier(newTier, currentTier) {
    const newRank = tierRank(newTier);
    const currentRank = tierRank(currentTier);
    if (newRank < 0) return false;
    if (currentRank < 0) return true;
    return newRank > currentRank;
}

function getTierPoints(tier) {
    const normalized = normalizeTier(tier);
    if (Object.prototype.hasOwnProperty.call(TIER_POINTS, normalized)) {
        return TIER_POINTS[normalized];
    }
    // Retired tier points mirror the matching active tier.
    if (isRetiredTier(normalized)) {
        const base = normalized.replace(/^R/, '');
        if (Object.prototype.hasOwnProperty.call(TIER_POINTS, base)) {
            return TIER_POINTS[base];
        }
    }
    return 0;
}

function getRetiredTier(peakTier) {
    const normalized = normalizeTier(peakTier);
    return RETIRED_TIER_MAP[normalized] || null;
}

function getRetiredPoints(peakOrRetiredTier) {
    const normalized = normalizeTier(peakOrRetiredTier);
    if (isRetiredTier(normalized)) {
        return getTierPoints(normalized);
    }
    const retired = getRetiredTier(normalized);
    if (retired) {
        return getTierPoints(retired);
    }
    return 0;
}

function getHigherPeak(currentPeak, newTier) {
    const normalizedPeak = normalizeTier(currentPeak);
    const normalizedNew = normalizeTier(newTier);

    if (!isActiveTier(normalizedNew)) {
        // Retired/unranked tiers never become a peak.
        return normalizedPeak && isActiveTier(normalizedPeak)
            ? normalizedPeak
            : null;
    }

    if (!normalizedPeak || !isActiveTier(normalizedPeak)) {
        return normalizedNew;
    }

    return isHigherTier(normalizedNew, normalizedPeak)
        ? normalizedNew
        : normalizedPeak;
}

function initializePeak(currentTier, newTier) {
    const current = normalizeTier(currentTier);
    const next = normalizeTier(newTier);

    if (current && isActiveTier(current)) return current;
    if (next && isActiveTier(next)) return next;
    return null;
}

module.exports = {
    ACTIVE_TIERS,
    TIER_POINTS,
    TIER_RANK,
    RETIRED_TIER_MAP,
    normalizeTier,
    isActiveTier,
    isRetiredTier,
    tierRank,
    isHigherTier,
    getTierPoints,
    getRetiredTier,
    getRetiredPoints,
    getHigherPeak,
    initializePeak
};
