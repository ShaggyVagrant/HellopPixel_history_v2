/**
 * history.js — История адресов кошельков (localStorage)
 */

import { isValidAddress, normalizeAddress } from './utils.js';

const STORAGE_KEY = 'addressHistory';
const MAX_HISTORY = 20;

/**
 * Загружает историю адресов из localStorage (только валидные).
 * @returns {string[]}
 */
export function loadAddressHistory() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        if (!Array.isArray(raw)) return [];
        const cleaned = raw
            .filter(addr => typeof addr === 'string' && isValidAddress(addr))
            .map(addr => normalizeAddress(addr));
        // дедуп по lower-case
        const seen = new Set();
        const unique = [];
        for (const addr of cleaned) {
            const key = addr.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(addr);
        }
        if (unique.length !== raw.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(unique.slice(0, MAX_HISTORY)));
        }
        return unique.slice(0, MAX_HISTORY);
    } catch {
        return [];
    }
}

/**
 * Сохраняет адрес в историю (в начало, без дублей). Только валидные.
 * @param {string} address
 * @returns {string[]} обновлённая история
 */
export function saveAddressHistory(address) {
    const normalized = normalizeAddress(address);
    if (!isValidAddress(normalized)) return loadAddressHistory();

    let history = loadAddressHistory();
    history = history.filter(addr => addr.toLowerCase() !== normalized.toLowerCase());
    history.unshift(normalized);
    if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return history;
}

/**
 * Обновляет datalist в DOM.
 * @param {HTMLDataListElement} datalistEl
 * @param {string[]} history
 */
export function updateDatalist(datalistEl, history) {
    if (!datalistEl) return;
    datalistEl.innerHTML = '';
    (history || []).forEach(addr => {
        if (!isValidAddress(addr)) return;
        const option = document.createElement('option');
        option.value = addr;
        datalistEl.appendChild(option);
    });
}
