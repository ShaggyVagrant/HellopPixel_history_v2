/**
 * method-detector.js — Определение метода транзакции
 */

import { CONFIG } from './config.js';
import { getAddress } from './utils.js';

/**
 * Кешированное получение метода (записывает в tx._detectedMethod).
 * @param {object} tx
 * @returns {string}
 */
export function getMethod(tx) {
    const cached = tx._detectedMethod;
    // Не доверяем кешу, если там сырая сигнатура 0x… (могли закешировать до маппинга)
    if (cached && !/^0x[0-9a-fA-F]{8}$/.test(cached)) {
        return cached;
    }
    const method = detectMethod(tx);
    tx._detectedMethod = method;
    return method;
}

/**
 * Основная логика определения метода.
 * @param {object} tx
 * @returns {string}
 */
export function detectMethod(tx) {
    let method = tx.method || tx.method_name || null;

    // API иногда отдаёт method как сигнатуру (0x42b0f52f) — маппим в имя
    if (method && /^0x[0-9a-fA-F]{8}$/.test(method)) {
        method = CONFIG.SIGNATURES[method.toLowerCase()] || method;
    }

    // Если метода нет — пробуем input
    if (!method && tx.input && tx.input.length >= 10) {
        const signature = tx.input.slice(0, 10).toLowerCase();
        method = CONFIG.SIGNATURES[signature] || null;
    }

    // Если method всё ещё похож на сигнатуру (на всякий случай из input-пути)
    if (method && /^0x[0-9a-fA-F]{8}$/.test(method)) {
        method = CONFIG.SIGNATURES[method.toLowerCase()] || method;
    }

    if (!method && tx.log_events && tx.log_events.length > 0) {
        const event = tx.log_events[0];
        if (event && event.event_name) {
            method = CONFIG.EVENTS[event.event_name] || null;
        }
    }

    if (!method && tx.token && tx.token.type === 'ERC-20') {
        method = 'transfer';
    }

    // Для внутренних транзакций
    if (tx._isInternal && method === 'transfer') {
        if (tx._orderDetails) {
            return tx._orderDetails.method || 'transfer';
        }
        return 'transfer';
    }

    if (method) {
        const tokenSymbol = (tx.token?.symbol || '').toUpperCase();
        const tokenName = (tx.token?.name || '').toUpperCase();
        const toAddress = getAddress(tx.to).toLowerCase();
        const fromAddress = getAddress(tx.from).toLowerCase();

        // Пополнение синдиката
        const popolnenieRules = CONFIG.SPECIALS.popolnenie_sindikata;
        for (const rule of popolnenieRules) {
            if (method !== rule.method) continue;
            let match = true;
            if (rule.tokenSymbol) {
                const symbols = rule.tokenSymbol.map(s => s.toUpperCase());
                const found = symbols.some(sym => tokenSymbol.includes(sym));
                if (!found) match = false;
            }
            if (rule.tokenName && !tokenName.includes(rule.tokenName.toUpperCase())) {
                match = false;
            }
            if (rule.toAddress && toAddress !== rule.toAddress.toLowerCase()) {
                match = false;
            }
            if (match) return 'popolnenie_sindikata';
        }

        // Прокачка хранилища
        const storeRule = CONFIG.SPECIALS.prokachka_hranilisha;
        if (method === storeRule.method && toAddress === storeRule.toAddress.toLowerCase()) {
            return 'prokachka_hranilisha';
        }

        // Прокачка дрели
        const drillRule = CONFIG.SPECIALS.prokachka_dreli;
        if (method === drillRule.method && toAddress === drillRule.toAddress.toLowerCase()) {
            return 'prokachka_dreli';
        }

        // Распаковка пыли
        const dustRule = CONFIG.SPECIALS.raspakovka_pyli;
        if (method === dustRule.method &&
            fromAddress === dustRule.fromAddress.toLowerCase()) {
            const symbols = dustRule.tokenSymbol.map(s => s.toUpperCase());
            const found = symbols.some(sym => tokenSymbol.includes(sym));
            if (found || tokenName.includes(dustRule.tokenName.toUpperCase())) {
                let amount = parseFloat(tx.total?.value || tx.value || 0);
                if (amount > 0) {
                    const decimals = tx.token?.decimals || 18;
                    tx._dustAmount = amount / Math.pow(10, decimals);
                }
                return 'raspakovka_pyli';
            }
        }

        // Запаковка пыли
        if (method === 'mint' ||
            (method === 'transferFromUser' &&
             toAddress === '0xF2279eBf926ee1dAf3F539C3ab2DD0ea97ca6b24'.toLowerCase())) {
            let amount = parseFloat(tx.total?.value || tx.value || 0);
            if (amount > 0) {
                const decimals = tx.token?.decimals || 18;
                tx._dustAmount = amount / Math.pow(10, decimals);
            }
            return 'mint';
        }
    }

    return method || 'other';
}
