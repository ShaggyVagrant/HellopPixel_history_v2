/**
 * render.js — Отрисовка таблицы, пагинации, статистики и итогов
 */

import { NETWORK_TOKEN, ITEMS_PER_PAGE } from './config.js';
import { state } from './state.js';
import {
    getAddress,
    truncateHash,
    getMethodClass,
    getMethodLabel,
    getTokenTypeBadge,
    getDateFromTransfer
} from './utils.js';
import { getMethod } from './method-detector.js';
import { isIncoming, applyFilters } from './filters.js';

/** DOM-ссылки (заполняются при init) */
let els = {};

/**
 * Инициализация DOM-ссылок для рендера.
 * @param {object} elements
 */
export function initRender(elements) {
    els = elements;
}

/**
 * Показать статус-сообщение.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 */
export function showStatus(message, type = 'info') {
    if (!els.statusMessage) return;
    els.statusMessage.textContent = message;
    els.statusMessage.className = 'status-message';
    if (type) els.statusMessage.classList.add(type);
    els.statusMessage.style.display = 'block';
}

/**
 * Обновление блока статистики.
 */
export function updateStats() {
    if (!els.statsBlock) return;

    if (!state.allTransfers || state.allTransfers.length === 0) {
        els.statsBlock.style.display = 'none';
        return;
    }

    const total = state.allTransfers.length;
    const internalCount = state.allTransfers.filter(t => t._isInternal === true).length;
    const normalCount = total - internalCount;
    const filtered = state.filteredTransfers.length;

    els.statsBlock.style.display = 'flex';
    if (els.totalCount) els.totalCount.textContent = total;
    if (els.displayedCount) els.displayedCount.textContent = filtered;

    const statsHtml = `
        <span>📊 Всего: <strong>${total}</strong></span>
        <span>🔹 Internal: <strong>${internalCount}</strong></span>
        <span>📄 Обычные: <strong>${normalCount}</strong></span>
        <span>🪙 Показано: <strong>${filtered}</strong></span>
    `;
    const statsExtra = document.getElementById('statsExtra');
    if (statsExtra) statsExtra.innerHTML = statsHtml;
}

/**
 * Рендер одной строки таблицы.
 * @param {object} transfer
 * @returns {HTMLTableRowElement}
 */
export function renderTransferRow(transfer) {
    const tr = document.createElement('tr');
    const method = getMethod(transfer);
    const incoming = isIncoming(transfer);
    const amount = parseFloat(transfer.total?.value || transfer.value || 0);
    const decimals = transfer.token?.decimals || 18;
    const formattedAmount = (amount / Math.pow(10, decimals)).toFixed(6);
    const amountClass = incoming ? 'incoming' : 'outgoing';
    const amountSign = incoming ? '+' : '-';
    const methodClass = getMethodClass(method);

    let methodLabel = getMethodLabel(method);
    if ((method === 'mint' || method === 'raspakovka_pyli') && transfer._dustAmount) {
        const tokenSymbolUpper = (transfer.token?.symbol || '').toUpperCase();
        if (tokenSymbolUpper === 'PXLD' || tokenSymbolUpper === 'PXLDUST') {
            const dustAmount = Math.round(transfer._dustAmount);
            methodLabel = `${methodLabel} (${dustAmount})`;
        }
    }

    const dateStr = getDateFromTransfer(transfer);
    let datePart = '—';
    let timePart = '—';
    if (dateStr !== '—') {
        const parts = dateStr.split(', ');
        if (parts.length === 2) {
            datePart = parts[0];
            timePart = parts[1];
        } else {
            datePart = dateStr;
        }
    }

    let tokenId = transfer.total?.token_id || transfer.token_id || transfer.tokenId || '';
    if ((method === 'executeOrder' || method === 'executeOrderInternal') && transfer._orderDetails?.tokenId) {
        tokenId = transfer._orderDetails.tokenId;
    }
    if (tokenId && typeof tokenId === 'string' && tokenId.startsWith('0x')) {
        tokenId = truncateHash(tokenId, 6);
    } else if (typeof tokenId === 'number' || (typeof tokenId === 'string' && !isNaN(tokenId))) {
        tokenId = String(tokenId);
    } else {
        tokenId = '';
    }

    const tokenType = transfer.token?.type || transfer.token_type || '';
    const tokenSymbolRaw = (transfer.token?.symbol || '').toUpperCase();
    const tokenName = (transfer.token?.name || '').toUpperCase();

    const isPXLNFT = tokenSymbolRaw.includes('PXLNFT') || tokenName.includes('PIXEL ITEM NFT');
    const isNFT = tokenType === 'ERC-721' || tokenType === 'ERC-1155';
    const isEquipUnequip = method === 'equip' || method === 'unequip';
    const isExecuteOrderInternal = method === 'executeOrderInternal';
    const showTokenId = (isPXLNFT || isNFT || (isEquipUnequip && tokenId) || isExecuteOrderInternal) && tokenId;

    const tokenInstance = transfer.total?.token_instance || {};
    const nftImageUrl = tokenInstance.image_url || tokenInstance.media_url || '';
    const nftName = tokenInstance.metadata?.name || tokenInstance.name || '';
    const nftData = transfer._nftData || {};
    const rarity = nftData.rarity || 0;

    const rarityColors = ['', '#ffffff', '#00ff66', '#00a2ff', '#cc00ff', '#ff7700'];
    const rarityGlow = ['', 'rgba(255,255,255,0.3)', 'rgba(0,255,102,0.4)', 'rgba(0,162,255,0.4)', 'rgba(204,0,255,0.4)', 'rgba(255,119,0,0.4)'];
    const rarityBorder = rarity > 0 ? `6px solid ${rarityColors[rarity]}` : 'none';
    const rarityShadow = rarity > 0 ? `0 0 20px ${rarityGlow[rarity]}` : 'none';
    const enableNFTChecked = els.enableNFTCheck?.checked || false;
    const showRarity = enableNFTChecked && rarity > 0;

    let tokenIdLink = '—';
    if (showTokenId && tokenId) {
        const encodedTokenId = encodeURIComponent(tokenId);
        if (nftImageUrl) {
            tokenIdLink = `<a href="./NFT/NFT_1.html?tokenId=${encodedTokenId}" target="_blank" class="token-link" title="${nftName || tokenId}" style="display: block; text-align: right;">
                <div style="border: ${showRarity ? rarityBorder : 'none'}; border-radius: 6px; box-shadow: ${showRarity ? rarityShadow : 'none'}; padding: ${showRarity ? '2px' : '0'}; display: inline-block; margin-left: auto; margin-right: 0;">
                    <img src="${nftImageUrl}"
                         alt="NFT ${tokenId}"
                         style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; display: block; transition: transform 0.2s;"
                         onmouseover="this.style.transform='scale(1.05)'"
                         onmouseout="this.style.transform='scale(1)'" />
                </div>
            </a>`;
        } else {
            tokenIdLink = `<a href="./NFT/NFT_1.html?tokenId=${encodedTokenId}" target="_blank" class="token-link">${tokenId}</a>`;
        }
    }

    let tokenSymbol = transfer.token?.symbol || '—';
    if (transfer._isInternal) {
        tokenSymbol = NETWORK_TOKEN;
    }

    let price = '—';
    if (method === 'stop' && transfer._stopReturn) {
        price = `${transfer._stopReturn.toFixed(6)} ${NETWORK_TOKEN}`;
    } else if (method === 'start' && transfer._reservedSGB) {
        price = `${transfer._reservedSGB.toFixed(6)} ${NETWORK_TOKEN}`;
    } else if (method === 'executeOrderInternal') {
        if (transfer._orderDetails?.priceInWei) {
            const priceInSgb = (parseFloat(transfer._orderDetails.priceInWei) / 1e18).toFixed(2);
            price = `${priceInSgb}`;
        } else {
            price = '⏳';
        }
    } else if (method === 'executeOrder' || method === 'createOrder') {
        price = transfer._price || '⏳';
    }

    tr.innerHTML = `
        <td data-label="Дата" class="col-date">
            <div class="date-cell">
                <span class="date-part">${datePart}</span>
                <span class="time-part">${timePart}</span>
            </div>
        </td>
        <td data-label="Хэш" class="col-hash">
            <a href="https://songbird-explorer.flare.network/tx/${transfer.transaction_hash}" target="_blank" class="hash cell-value">${truncateHash(transfer.transaction_hash, 8)}</a>
        </td>
        <td data-label="Отправитель" class="col-from">
            <a href="https://songbird-explorer.flare.network/address/${getAddress(transfer.from)}" target="_blank" class="hash cell-value">${truncateHash(getAddress(transfer.from), 8)}</a>
        </td>
        <td data-label="Получатель" class="col-to">
            <a href="https://songbird-explorer.flare.network/address/${getAddress(transfer.to)}" target="_blank" class="hash cell-value">${truncateHash(getAddress(transfer.to), 8)}</a>
        </td>
        <td data-label="Сумма" class="col-amount">
            <span class="amount ${amountClass} cell-value">${amountSign} ${formattedAmount}</span>
        </td>
        <td data-label="Токен" class="col-token">
            <span class="token-symbol cell-value">${tokenSymbol}</span>
        </td>
        <td data-label="Тип" class="col-type">
            <span class="cell-value">${getTokenTypeBadge(transfer.token?.type || transfer.token_type)}</span>
        </td>
        <td data-label="Метод" class="col-method">
            <span class="method-tag ${methodClass} cell-value">${methodLabel}</span>
        </td>
        <td data-label="Token ID" class="col-tokenid token-id">
            <span class="cell-value">${tokenIdLink}</span>
        </td>
        <td data-label="Цена ${NETWORK_TOKEN}" class="col-price price">
            <span class="cell-value">${price}</span>
        </td>
    `;
    return tr;
}

/**
 * Рендер таблицы (текущая страница).
 * @param {boolean} forceApply — пересчитать filteredTransfers
 * @param {function} collectFilterOptions — колбэк для сбора опций фильтров из DOM
 */
export function renderTransfers(forceApply = true, collectFilterOptions = null) {
    if (forceApply && typeof collectFilterOptions === 'function') {
        state.filteredTransfers = applyFilters(state.allTransfers, collectFilterOptions());
    } else if (forceApply) {
        // fallback — без доп. фильтров из DOM (только уже в state)
        state.filteredTransfers = applyFilters(state.allTransfers, {});
    }

    if (els.statsBlock) els.statsBlock.style.display = 'block';
    if (els.totalCount) els.totalCount.textContent = state.allTransfers.length;
    if (els.displayedCount) els.displayedCount.textContent = state.filteredTransfers.length;

    const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = state.filteredTransfers.slice(start, end);
    const totalPages = Math.ceil(state.filteredTransfers.length / ITEMS_PER_PAGE) || 1;

    els.prevPageBtns?.forEach(btn => { btn.disabled = state.currentPage <= 1; });
    els.nextPageBtns?.forEach(btn => { btn.disabled = state.currentPage >= totalPages; });
    els.firstPageBtns?.forEach(btn => { btn.disabled = state.currentPage <= 1; });
    els.lastPageBtns?.forEach(btn => { btn.disabled = state.currentPage >= totalPages; });

    const hasMoreData = !!(state.nextPageParams?.normal || state.nextPageParams?.internal);
    els.loadMoreBtns?.forEach(btn => {
        btn.disabled = !hasMoreData;
        btn.style.opacity = hasMoreData ? '1' : '0.5';
    });

    const showPagination = (state.filteredTransfers.length > 0) || hasMoreData;
    if (els.paginationControlsTop) {
        els.paginationControlsTop.style.display = showPagination ? 'flex' : 'none';
    }
    if (els.paginationControlsBottom) {
        els.paginationControlsBottom.style.display = showPagination ? 'flex' : 'none';
    }

    if (!els.transfersBody) return;

    els.transfersBody.innerHTML = '';
    if (pageItems.length === 0) {
        let message;
        if (state.allTransfers.length === 0) {
            message = 'Нет данных по этому адресу';
        } else if (state.filteredTransfers.length === 0 && !hasMoreData) {
            message = 'По выбранному фильтру транзакций не найдено во всей истории.';
        } else if (state.filteredTransfers.length === 0 && hasMoreData) {
            message = 'По вашему фильтру не найдено транзакций в загруженных страницах. Нажмите "Загрузить ещё" для продолжения поиска.';
        } else {
            message = 'Нет данных, соответствующих фильтрам';
        }
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `<td colspan="10" class="empty-state">${message}</td>`;
        els.transfersBody.appendChild(emptyRow);
        return;
    }

    const fragment = document.createDocumentFragment();
    pageItems.forEach(transfer => fragment.appendChild(renderTransferRow(transfer)));
    els.transfersBody.appendChild(fragment);
    // renderPageNumbers вызывается из doRender с колбэком goToPage
}

/**
 * Рендер номеров страниц.
 * @param {function} onGoToPage
 */
export function renderPageNumbers(onGoToPage = null) {
    const totalPages = Math.ceil(state.filteredTransfers.length / ITEMS_PER_PAGE) || 1;
    const current = state.currentPage;

    function getPageNumbersHTML() {
        let html = '';
        const maxVisible = 7;
        let startPage = 1;
        let endPage = totalPages;

        if (totalPages > maxVisible) {
            const half = Math.floor(maxVisible / 2);
            if (current <= half + 1) {
                startPage = 1;
                endPage = maxVisible;
            } else if (current >= totalPages - half) {
                startPage = totalPages - maxVisible + 1;
                endPage = totalPages;
            } else {
                startPage = current - half;
                endPage = current + half;
            }
        }

        if (startPage > 1) {
            html += `<button class="page-number" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span class="page-number ellipsis">…</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === current;
            html += `<button class="page-number ${isActive ? 'active' : ''}" data-page="${i}" ${isActive ? 'disabled' : ''}>${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span class="page-number ellipsis">…</span>`;
            }
            html += `<button class="page-number" data-page="${totalPages}">${totalPages}</button>`;
        }

        return html;
    }

    const html = getPageNumbersHTML();
    if (els.pageNumbersTop) els.pageNumbersTop.innerHTML = html;
    if (els.pageNumbersBottom) els.pageNumbersBottom.innerHTML = html;

    document.querySelectorAll('.page-number:not(.ellipsis):not([disabled])').forEach(btn => {
        btn.addEventListener('click', function () {
            const page = parseInt(this.dataset.page, 10);
            if (!isNaN(page) && page !== state.currentPage && typeof onGoToPage === 'function') {
                onGoToPage(page);
            }
        });
    });
}

let loadingIndicatorShown = false;

export function showLoadingIndicator(show = true) {
    if (!els.transfersBody) return;
    if (show) {
        if (!loadingIndicatorShown) {
            const row = document.createElement('tr');
            row.id = 'loadingIndicatorRow';
            row.innerHTML = `<td colspan="10" class="loading-indicator">
                <span class="spinner"></span> Загрузка данных...
            </td>`;
            els.transfersBody.appendChild(row);
            loadingIndicatorShown = true;
        }
    } else {
        const row = document.getElementById('loadingIndicatorRow');
        if (row) row.remove();
        loadingIndicatorShown = false;
    }
}

export function setLoadMoreButtonLoading(loading = false) {
    els.loadMoreBtns?.forEach(btn => {
        if (loading) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Загрузка...';
            btn.style.opacity = '1';
        } else {
            const hasMore = !!(state.nextPageParams?.normal || state.nextPageParams?.internal);
            btn.disabled = !hasMore;
            btn.innerHTML = 'Загрузить ещё';
            btn.style.opacity = hasMore ? '1' : '0.5';
        }
    });
}

/**
 * Итоги по токенам.
 */
export function updateSummary() {
    const summaryBody = document.getElementById('summaryBody');
    if (!summaryBody) return;

    const enableSummary = document.getElementById('enableSummary');
    if (!enableSummary || !enableSummary.checked) {
        summaryBody.innerHTML = `<tr><td colspan="4" class="empty-state">Итоги отключены (включите в Advanced)</td></tr>`;
        return;
    }

    const totals = {};
    let hasMarketActivity = false;

    state.filteredTransfers.forEach(t => {
        let symbol = t.token?.symbol || '';
        if (!symbol && t._isInternal) {
            symbol = NETWORK_TOKEN;
        }
        if (!symbol) return;

        symbol = symbol.toUpperCase();
        const method = getMethod(t);
        if (method === 'executeOrder' || method === 'executeOrderInternal' || method === 'stop') {
            hasMarketActivity = true;
        }

        if (!totals[symbol]) {
            totals[symbol] = { income: 0, outcome: 0 };
        }

        const isIncomingTx = isIncoming(t);
        const tokenType = t.token?.type || t.token_type || '';
        const isNFT = (tokenType === 'ERC-721' || symbol === 'PXLNFT');
        let amount = 0;

        if (method === 'executeOrder' && t._price) {
            const priceSymbol = NETWORK_TOKEN.toUpperCase();
            if (!totals[priceSymbol]) totals[priceSymbol] = { income: 0, outcome: 0 };
            const price = parseFloat(t._price);
            if (!isNaN(price) && price > 0) {
                totals[priceSymbol].outcome += price;
            }
            if (isNFT) totals[symbol].income += 1;
            return;
        }

        if (method === 'executeOrderInternal') {
            const priceSymbol = NETWORK_TOKEN.toUpperCase();
            if (!totals[priceSymbol]) totals[priceSymbol] = { income: 0, outcome: 0 };
            const rawAmount = parseFloat(t.value || t.total?.value || 0);
            if (!isNaN(rawAmount) && rawAmount > 0) {
                totals[priceSymbol].income += rawAmount / 1e18;
            }
            if (isNFT) totals[symbol].outcome += 1;
            return;
        }

        if (isNFT) {
            amount = 1;
        } else {
            let rawAmount = 0;
            let decimals = 18;
            if (t.total?.value) {
                rawAmount = parseFloat(t.total.value);
                if (t.total.decimals !== undefined) decimals = parseInt(t.total.decimals, 10);
            } else if (t.value) {
                rawAmount = parseFloat(t.value);
            }
            if (!isNaN(rawAmount) && rawAmount > 0) {
                amount = rawAmount / Math.pow(10, decimals);
            }
        }

        if (isIncomingTx) {
            totals[symbol].income += amount;
        } else {
            totals[symbol].outcome += amount;
        }

        if (method === 'stop') {
            const priceSymbol = NETWORK_TOKEN.toUpperCase();
            if (!totals[priceSymbol]) totals[priceSymbol] = { income: 0, outcome: 0 };
            const stopAmount = parseFloat(t._stopReturn || 0);
            if (!isNaN(stopAmount) && stopAmount > 0) {
                totals[priceSymbol].income += stopAmount;
            }
            return;
        }

        if (method === 'start' && t._reservedSGB) {
            const priceSymbol = NETWORK_TOKEN.toUpperCase();
            if (!totals[priceSymbol]) totals[priceSymbol] = { income: 0, outcome: 0 };
            const startAmount = parseFloat(t._reservedSGB);
            if (!isNaN(startAmount) && startAmount > 0) {
                totals[priceSymbol].outcome += startAmount;
            }
            return;
        }

        if (amount === 0) return;
    });

    if (Object.keys(totals).length === 0) {
        summaryBody.innerHTML = `<tr><td colspan="4" class="empty-state">Нет данных по токенам</td></tr>`;
        return;
    }

    const tokenList = Object.keys(totals);
    if (hasMarketActivity && !tokenList.includes(NETWORK_TOKEN.toUpperCase())) {
        tokenList.push(NETWORK_TOKEN.toUpperCase());
        totals[NETWORK_TOKEN.toUpperCase()] = { income: 0, outcome: 0 };
    }

    tokenList.sort((a, b) => {
        if (a === NETWORK_TOKEN.toUpperCase()) return -1;
        if (b === NETWORK_TOKEN.toUpperCase()) return 1;
        return a.localeCompare(b);
    });

    let html = '';
    tokenList.forEach(symbol => {
        const data = totals[symbol];
        const total = data.income - data.outcome;
        const isNFT = (symbol === 'PXLNFT');
        const decimalsDisplay = isNFT ? 0 : 4;
        const totalClass = total > 0 ? 'total-positive' : (total < 0 ? 'total-negative' : 'total-zero');

        html += `
            <tr>
                <td class="token-cell">${symbol}</td>
                <td class="positive">+${data.income.toFixed(decimalsDisplay)}</td>
                <td class="negative">-${data.outcome.toFixed(decimalsDisplay)}</td>
                <td class="${totalClass}">${total >= 0 ? '+' : ''}${total.toFixed(decimalsDisplay)}</td>
            </tr>
        `;
    });

    summaryBody.innerHTML = html;
}
