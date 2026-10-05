/**
 * config.js — Константы и конфигурация приложения
 * Только данные, без DOM и сетевых запросов.
 */

export const API_BASE_URL = 'https://songbird-explorer.flare.network/api/v2';
export const NETWORK_TOKEN = 'SGB';
export const ITEMS_PER_PAGE = 20;
export const INITIAL_LOAD_PAGES = 3;
export const DEBOUNCE_DELAY = 200;

export const CONFIG = {
    // Только проверенные method_id (decoded_input Explorer / стандарт ERC).
    // Неизвестные hex остаются как есть и показываются в UI, пока не добавим сюда.
    SIGNATURES: {
        // ERC standard
        '0xa9059cbb': 'transfer',
        '0x23b872dd': 'transferFrom',
        '0x095ea7b3': 'approve',
        '0x40c10f19': 'mint',
        '0x42966c68': 'burn',
        '0x2e1a7d4d': 'withdraw',
        // Hello Pixel — подтверждены через decoded_input
        '0x07da68f5': 'stop',
        '0x95805dad': 'start',
        '0x42b0f52f': 'claimForUser',
        '0x6759647a': 'claimReward',
        '0x05fb83e6': 'returnDroneAndClaimReward',
        '0x3d668168': 'equip',
        '0xae7b0333': 'executeOrder',
        '0xa3985db7': 'claimFreeChest'
        // Новые hex: либо сюда, либо подтянутся из decoded_input Explorer
    },
    EVENTS: {
        'Transfer': 'transfer',
        'Approval': 'approve',
        'Mint': 'mintForOne',
        'Burn': 'burn',
        'OrderCreated': 'createOrder',
        'OrderExecuted': 'executeOrder',
        'ChestClaimed': 'claimFreeChest',
        'Start': 'start',
        'Stop': 'stop',
        'ReturnDroneAndClaimReward': 'returnDroneAndClaimReward',
        'PurchaseChestForPXLs': 'purchaseChestForPXLs',
        'OperatorBurnFrom': 'operatorBurnFrom',
        'BuySizeLevel': 'buySizeLevel',
        'Equip': 'equip',
        'Unequip': 'unequip',
        'Craft': 'craft',
        'CancelOrder': 'cancelOrder',
        'BuySpeedLevel': 'buySpeedLevel',
        'UpgradeMine': 'upgradeMine',
        'ClaimForUser': 'claimForUser',
        'ClaimReward': 'claimReward',
        'UnlockSlot': 'unlockSlot',
        'Lock': 'lock',
        'Unlock': 'unlock'
    },
    SPECIALS: {
        popolnenie_sindikata: [
            { method: 'operatorBurnFrom', tokenSymbol: ['PXLD', 'PXLDust'], tokenName: 'PXLDust' },
            { method: 'burn', tokenSymbol: ['PXLs'], tokenName: 'Pixel Shard' },
            { method: 'transferFrom', toAddress: '0x4BF7a440F0A1D576A0D8d7397480585A89fdC7de' }
        ],
        prokachka_hranilisha: {
            method: 'buySizeLevel',
            toAddress: '0x0000000000000000000000000000000000000000'
        },
        prokachka_dreli: {
            method: 'buySpeedLevel',
            toAddress: '0x0000000000000000000000000000000000000000'
        },
        raspakovka_pyli: {
            method: 'transferFromUser',
            fromAddress: '0xF2279eBf926ee1dAf3F539C3ab2DD0ea97ca6b24',
            tokenSymbol: ['PXLD'],
            tokenName: 'PXLDust'
        }
    }
};

export const METHOD_COLORS = {
    'mintForOne': 'method-mintForOne',
    'burn': 'method-burn',
    'createOrder': 'method-createOrder',
    'executeOrder': 'method-executeOrder',
    'executeOrderInternal': 'method-executeOrder',
    'claimFreeChest': 'method-claimFreeChest',
    'start': 'method-start',
    'stop': 'method-stop',
    'returnDroneAndClaimReward': 'method-returnDroneAndClaimReward',
    'purchaseChestForPXLs': 'method-purchaseChestForPXLs',
    'popolnenie_sindikata': 'method-popolnenie_sindikata',
    'prokachka_hranilisha': 'method-prokachka_hranilisha',
    'prokachka_dreli': 'method-prokachka_dreli',
    'equip': 'method-equip',
    'unequip': 'method-unequip',
    'craft': 'method-craft',
    'cancelOrder': 'method-cancelOrder',
    'claimForUser': 'method-claimForUser',
    'claimReward': 'method-claimReward',
    'transfer': 'method-transfer',
    'upgradeMine': 'method-upgradeMine',
    'mint': 'method-mint',
    'raspakovka_pyli': 'method-raspakovka_pyli',
    'unlockSlot': 'method-unlockSlot',
    'lock': 'method-lock',
    'unlock': 'method-unlock',
    'unknown': 'method-unknown',
    'other': 'method-other',
    // hex → те же классы, что у имён
    '0x42b0f52f': 'method-claimForUser',
    '0x6759647a': 'method-claimReward',
    '0x95805dad': 'method-start',
    '0x07da68f5': 'method-stop',
    '0x05fb83e6': 'method-returnDroneAndClaimReward',
    '0x3d668168': 'method-equip',
    '0xa3985db7': 'method-claimFreeChest'
};

export const METHOD_LABELS = {
    'mintForOne': 'От команды (ЛБ, за рефов)',
    'burn': 'Крафт',
    'createOrder': 'Выставлен на продажу',
    'executeOrder': 'Куплен на рынке',
    'executeOrderInternal': 'Продан на рынке',
    'claimFreeChest': 'Открыть сундук',
    'start': 'Запуск УС',
    'stop': 'Стоп УС',
    'returnDroneAndClaimReward': 'Клейм пыли',
    'purchaseChestForPXLs': 'Куплен дрон за PXLs',
    'popolnenie_sindikata': 'Пополнение синдиката',
    'prokachka_hranilisha': 'Прокачка хранилища',
    'upgradeMine': 'Прокачка шахты',
    'prokachka_dreli': 'Прокачка дрели',
    'equip': 'Надеть NFT',
    'unequip': 'Снять NFT',
    'craft': 'Крафт по рецепту',
    'cancelOrder': 'Снято с продажи',
    'claimForUser': 'Автоклейм',
    'claimReward': 'Ручной клейм',
    'mint': 'Запаковка пыли',
    'raspakovka_pyli': 'Распаковка пыли',
    'unlockSlot': 'Открытие слота',
    'transfer': 'transfer',
    'lock': 'Земля в аренду',
    'unlock': 'Вернуть землю',
    'unknown': 'неизвестно',
    // дубли по сигнатурам — чтобы бейдж работал даже если detectMethod не отработал
    '0x42b0f52f': 'Автоклейм',
    '0x6759647a': 'Ручной клейм',
    '0x95805dad': 'Запуск УС',
    '0x07da68f5': 'Стоп УС',
    '0x05fb83e6': 'Клейм пыли',
    '0x3d668168': 'Надеть NFT',
    '0xa3985db7': 'Открыть сундук'
};

/**
 * Единый маппинг method/signature → каноническое имя.
 * Работает с "claimForUser", "0x42b0f52f", "0X42B0F52F".
 */
export function resolveSignature(method) {
    if (!method || typeof method !== 'string') return method || '';
    const trimmed = method.trim();
    // точное совпадение с именем
    if (METHOD_LABELS[trimmed]) return trimmed;
    // hex-сигнатура
    const m = trimmed.match(/0x[0-9a-fA-F]{8}/i);
    if (m) {
        const sig = m[0].toLowerCase();
        if (CONFIG.SIGNATURES[sig]) return CONFIG.SIGNATURES[sig];
        // fallback: если сигнатура есть как ключ в LABEL (на случай рассинхрона)
        if (METHOD_LABELS[sig]) return sig;
    }
    return trimmed;
}


