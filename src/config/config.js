module.exports = {
    ownerId: '1434463040622952510',
    colors: {
        primary: 0x8B0000,
        secondary: 0x000000,
        success: 0x2ECC71,
        error: 0xE74C3C
    },

    // Role IDs are now stored in Supabase `kairo_role_configs`.
    // Non-role configuration only.
    gamemodes: [
        'Sword', 'Mace', 'Axe', 'DiaPot', 'SMP', 'UHC',
        'spearmace', 'diasmp', 'manhunt', 'shieldlessuhc', 'cart', 'Speed'
    ],

    channels: {
        results: '1570452165234003988',
        ticketCategory: '1570452102499672158',
        transcriptChannel: '1570452203934716036',
        queues: {
            '1570452178445795338': 'Sword',
            '1570452181168169081': 'Mace',
            '1570452184011903047': 'Axe',
            '1570452182485176364': 'SMP',
            '1570452185492357211': 'UHC',
            '1570452179720863876': 'DiaPot',
            '1570452212293959772': 'spearmace',
            '1570452215947198586': 'diasmp',
            '1570452210419105804': 'manhunt',
            '1570452208900775936': 'shieldlessuhc',
            '1570452217654157332': 'cart',
            '1574823201479983306': 'Speed'
        },
    },

    // Legacy waitlist role IDs (fallback until saved in Supabase)
    roles: {
        waitlist: {
            Axe: '1570451933863346176',
            Sword: '1570451949105582080',
            UHC: '1570451950082719840',
            SMP: '1570451946551386244',
            DiaPot: '1570451948090429531',
            Mace: '1570451943875285094',
            spearmace: '1570451934794481696',
            diasmp: '1570451940905582614',
            manhunt: '1570451936606425299',
            shieldlessuhc: '1570451937692745820',
            cart: '1570451939240448041'
        }
    },

    // Gamemode display names

    gamemodeNames: {
        spearmace: 'SpearMace',
        diasmp: 'Diamond SMP',
        manhunt: 'Manhunt',
        shieldlessuhc: 'ShieldLess UHC',
        cart: 'Cart',
        Speed: 'Speed'
    }
};