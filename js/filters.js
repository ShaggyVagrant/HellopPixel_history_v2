/**
 * filters.js — Фильтрация и сортировка транзакций
 */

import { NETWORK_TOKEN } from './config.js';
import { state } from './state.js';
import { getAddress } from './utils.js';
import { getMethod } from './method-detector.js';

/**
 * Проверяет, входящая ли транзакция относительно текущего адреса.
 * @param {object} transfer
 * @returns {boolean}
 */
export function isIncoming(transfer) {
    const to = getAddress(transfer.to);
    return to.toLowerCase() === state.currentAddress.toLowerCase();
}

/**
 * Собирает выбранные методы из чекбоксов.
 * @param {NodeListOf<HTMLInputElement>} methodCheckboxes
 * @returns {string[]|null} null = «Все»
 */
export function getSelectedMethods(methodCheckboxes) {
    const selected = [];
    let allChecked = false;
    methodCheckboxes.forEach(cb => {
        const method = cb.dataset.method;
        if (method === 'all') allChecked = cb.checked;
        else if (cb.checked) selected.push(method);
    });
    if (allChecked || selected.length === 0) return null;
    return selected;
}

/**
 * Применяет все фильтры к массиву транзакций.
 * @param {object[]} transfers
 * @param {object} options — DOM-значения фильтров
 * @returns {object[]}
 */
export function applyFilters(transfers, options = {}) {
    let result = [...transfers];

    const {
        internalOnly = false,
        normalOnly = false,
        incomingOnly = false,
        outgoingOnly = false,
        selectedToken = 'all',
        selectedMethods = null,
        rarityValue = 'all',
        enableNFT = false
    } = options;

    // 1. Internal / Normal
    if (internalOnly && !normalOnly) {
        result = result.filter(t => t._isInternal === true);
    } else if (normalOnly && !internalOnly) {
        result = result.filter(t => !t._isInternal);
    }

    // 2. Internal: пока история догружается, не показываем internal старше
    // самого старого уже загруженного normal (иначе «висят» старые internal без контекста).
    // Когда nextPageParams пуст (всё загружено) — фильтр не применяем.
    const stillLoading = !!(state.nextPageParams?.normal || state.nextPageParams?.internal);
    if (stillLoading) {
        const allNormals = state.allTransfers.filter(t => !t._isInternal);
        if (allNormals.length > 0) {
            let minTs = Infinity;
            for (const t of allNormals) {
                const ts = new Date(t.timestamp || 0).getTime();
                if (ts && ts < minTs) minTs = ts;
            }
            if (minTs !== Infinity) {
                const lastNormalDate = new Date(minTs);
                result = result.filter(t => {
                    if (!t._isInternal) return true;
                    return new Date(t.timestamp || 0) >= lastNormalDate;
                });
            }
        }
    }

    // 3. Направление
    if (incomingOnly && !outgoingOnly) {
        result = result.filter(t => isIncoming(t));
    } else if (outgoingOnly && !incomingOnly) {
        result = result.filter(t => !isIncoming(t));
    }

    // 4. Токен
    if (selectedToken !== 'all') {
        result = result.filter(t => {
            let symbol = (t.token?.symbol || '').toUpperCase();
            if (t._isInternal && parseFloat(t.value || t.total?.value || 0) > 0) {
                symbol = NETWORK_TOKEN.toUpperCase();
            }
            return symbol === selectedToken.toUpperCase();
        });
    }

    // 5. Методы
    if (selectedMethods !== null && selectedMethods.length > 0) {
        result = result.filter(t => {
            const method = getMethod(t);
            return selectedMethods.includes(method);
        });
    }

    // 6. Редкость NFT
    if (rarityValue !== 'all' && enableNFT) {
        result = result.filter(t => {
            const nftData = t._nftData;
            return nftData && String(nftData.rarity) === rarityValue;
        });
    }

    return result;
}

/**
 * Сортировка allTransfers по timestamp.
 */
export function applySorting() {
    if (!state.allTransfers.length) return;
    state.allTransfers.sort((a, b) => {
        const tsA = new Date(a.timestamp || a.block_timestamp || 0).getTime();
        const tsB = new Date(b.timestamp || b.block_timestamp || 0).getTime();
        if (state.sortOrder === 'desc') {
            return tsB - tsA;
        }
        return tsA - tsB;
    });
}
