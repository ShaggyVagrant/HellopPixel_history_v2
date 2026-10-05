/**
 * utils.js — Чистые вспомогательные функции
 * Без DOM и без зависимости от состояния приложения.
 */

import { CONFIG, METHOD_COLORS, METHOD_LABELS, resolveSignature } from './config.js';

/**
 * Извлекает адрес из объекта или строки.
 * @param {string|object|null} obj
 * @returns {string}
 */
export function getAddress(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj?.hash || obj?.address || '';
}

/**
 * Строгая проверка EVM-адреса: 0x + ровно 40 hex-символов.
 * Отсекает XSS/мусор — в API и localStorage попадают только валидные адреса.
 * @param {string} address
 * @returns {boolean}
 */
export function isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

/**
 * Нормализация адреса (trim). Checksum не трогаем — API Songbird case-insensitive.
 * @param {string} address
 * @returns {string}
 */
export function normalizeAddress(address) {
    return (address || '').trim();
}

/**
 * Обрезает хэш для отображения.
 * @param {string} hash
 * @param {number} chars
 * @returns {string}
 */
export function truncateHash(hash, chars = 6) {
    if (!hash) return '—';
    if (hash.length <= chars * 2 + 2) return hash;
    return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

/**
 * Нормализует method: 0x42b0f52f → claimForUser.
 * @param {string} method
 * @returns {string}
 */
export function normalizeMethodKey(method) {
    return resolveSignature(method);
}

/**
 * Возвращает CSS-класс для метода.
 * @param {string} method
 * @returns {string}
 */
export function getMethodClass(method) {
    const key = resolveSignature(method);
    // если key всё ещё hex — METHOD_COLORS может иметь hex-ключ
    return METHOD_COLORS[key] || METHOD_COLORS[method] || METHOD_COLORS.other;
}

/**
 * Возвращает человекочитаемую метку метода.
 * @param {string} method
 * @returns {string}
 */
export function getMethodLabel(method) {
    if (!method) return 'другой';
    const key = resolveSignature(method);
    // 1) по каноническому имени  2) по исходному (в т.ч. hex-алиас в METHOD_LABELS)
    return METHOD_LABELS[key] || METHOD_LABELS[method] || METHOD_LABELS[String(method).toLowerCase()] || key;
}

/**
 * Возвращает HTML-бейдж типа токена.
 * @param {string} type
 * @returns {string}
 */
export function getTokenTypeBadge(type) {
    if (!type) return '<span class="badge badge-erc20">ERC-20</span>';
    const map = {
        'ERC-20': 'badge-erc20',
        'ERC-721': 'badge-erc721',
        'ERC-1155': 'badge-erc1155'
    };
    const cls = map[type] || 'badge-erc20';
    return `<span class="badge ${cls}">${type}</span>`;
}

/**
 * Форматирует дату транзакции в локальную строку.
 * @param {object} transfer
 * @returns {string}
 */
export function getDateFromTransfer(transfer) {
    let ts = transfer.timestamp || transfer.block_timestamp || transfer.time ||
             transfer.created_at || transfer.date || transfer.timestamp_utc ||
             transfer.timestamp_in_seconds || transfer.timestamp_unix;

    if (!ts && transfer.block) {
        ts = transfer.block.timestamp || transfer.block.block_timestamp;
    }
    if (!ts && transfer.transaction) {
        ts = transfer.transaction.timestamp;
    }
    if (ts === undefined || ts === null || ts === '') return '—';

    let timestampMs;
    if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        if (!isNaN(parsed)) {
            timestampMs = parsed;
        } else {
            const num = parseFloat(ts);
            if (!isNaN(num)) timestampMs = num;
            else return '—';
        }
    } else if (typeof ts === 'number') {
        timestampMs = ts;
    } else {
        return '—';
    }

    if (timestampMs < 1e12) timestampMs = timestampMs * 1000;

    const date = new Date(timestampMs);
    if (isNaN(date.getTime())) return '—';

    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Возвращает версию приложения из meta-тега.
 * @returns {string}
 */
export function getAppVersion() {
    const meta = document.querySelector('meta[name="app-version"]');
    return meta ? meta.getAttribute('content') : '0.0.1';
}


/**
 * Короткий бип об успешной загрузке (Web Audio API).
 * На мобиле может быть заблокирован политикой autoplay — тогда тихо игнорируем.
 */
export function playSuccessBeep() {
    try {
        // Выключено в Advanced или localStorage
        const el = document.getElementById('enableSound');
        if (el && !el.checked) return;
        if (!el && localStorage.getItem('enableSound') === 'false') return;

        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.16);
        osc.onended = () => {
            try { ctx.close(); } catch (_) { /* ignore */ }
        };
    } catch (_) {
        // нет AudioContext / политика браузера — молча
    }
}
