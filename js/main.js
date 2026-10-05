/**
 * main.js — Точка входа, оркестрация, инициализация
 */

import {
    NETWORK_TOKEN,
    ITEMS_PER_PAGE,
    INITIAL_LOAD_PAGES,
    DEBOUNCE_DELAY
} from './config.js';
import { state, setCurrentAddress, setLoading, setFilterLoading, setSortOrder, setDateFilter, resetTransfersState } from './state.js';
import { getAppVersion, playSuccessBeep, isValidAddress, normalizeAddress } from './utils.js';
import { getMethod } from './method-detector.js';
import {
    fetchTokenTransfers,
    fetchInternalTransfers
} from './api.js';
import {
    enrichWithPrices,
    enrichWithNFTData,
    enrichStartTransactions,
    enrichInternalTransactions,
    enrichUnknownMethodNames
} from './enrichment.js';
import {
    applyFilters,
    applySorting,
    getSelectedMethods
} from './filters.js';
import {
    loadAddressHistory,
    saveAddressHistory,
    updateDatalist
} from './history.js';
import {
    initRender,
    showStatus,
    updateStats,
    renderTransfers,
    renderPageNumbers,
    showLoadingIndicator,
    setLoadMoreButtonLoading,
    updateSummary
} from './render.js';

// --- DOM ---
const addressInput = document.getElementById('addressInput');
const addressHistoryDatalist = document.getElementById('addressHistory');
const tokenTypeFilter = document.getElementById('tokenTypeFilter');
const fetchBtn = document.getElementById('fetchBtn');
const statusMessage = document.getElementById('statusMessage');
const statsBlock = document.getElementById('statsBlock');
const totalCount = document.getElementById('totalCount');
const displayedCount = document.getElementById('displayedCount');
const showIncomingCheck = document.getElementById('showOnlyIncoming');
const showOnlyOutgoingCheck = document.getElementById('showOnlyOutgoing');
const methodCheckboxes = document.querySelectorAll('.method-checkbox');
const paginationControlsTop = document.getElementById('paginationControlsTop');
const paginationControlsBottom = document.getElementById('paginationControlsBottom');
const pageNumbersTop = document.getElementById('pageNumbersTop');
const pageNumbersBottom = document.getElementById('pageNumbersBottom');
const firstPageBtns = document.querySelectorAll('.firstPageBtn');
const prevPageBtns = document.querySelectorAll('.prevPageBtn');
const nextPageBtns = document.querySelectorAll('.nextPageBtn');
const lastPageBtns = document.querySelectorAll('.lastPageBtn');
const loadMoreBtns = document.querySelectorAll('.load-more-btn');
const filtersHeader = document.getElementById('filtersHeader');
const filtersToggle = document.getElementById('filtersToggle');
const filtersContent = document.getElementById('filtersContent');
const tokenSymbolFilter = document.getElementById('tokenSymbolFilter');
const startDateFilter = document.getElementById('startDateFilter');
const endDateFilter = document.getElementById('endDateFilter');
const applyDateFilterBtn = document.getElementById('applyDateFilter');
const clearDateFilterBtn = document.getElementById('clearDateFilter');
const enableNFTCheck = document.getElementById('enableNFT');
const rarityFilter = document.getElementById('rarityFilter');
const rarityFilterWrapper = document.getElementById('rarityFilterWrapper');
const sortRadios = document.querySelectorAll('input[name="sortOrder"]');
const transfersBody = document.getElementById('transfersBody');

initRender({
    statusMessage,
    statsBlock,
    totalCount,
    displayedCount,
    prevPageBtns,
    nextPageBtns,
    firstPageBtns,
    lastPageBtns,
    loadMoreBtns,
    paginationControlsTop,
    paginationControlsBottom,
    pageNumbersTop,
    pageNumbersBottom,
    transfersBody,
    enableNFTCheck
});

/** Сбор опций фильтров из DOM */
function collectFilterOptions() {
    return {
        internalOnly: document.getElementById('showOnlyInternal')?.checked || false,
        normalOnly: document.getElementById('showOnlyNormal')?.checked || false,
        incomingOnly: showIncomingCheck?.checked || false,
        outgoingOnly: showOnlyOutgoingCheck?.checked || false,
        selectedToken: tokenSymbolFilter?.value || 'all',
        selectedMethods: getSelectedMethods(methodCheckboxes),
        rarityValue: rarityFilter?.value || 'all',
        enableNFT: enableNFTCheck?.checked || false
    };
}

function doRender(forceApply = true) {
    renderTransfers(forceApply, collectFilterOptions);
    // re-bind page numbers with goToPage
    renderPageNumbers(goToPage);
    updateStats();
}

function updateRarityFilterVisibility() {
    const isNFTEnabled = enableNFTCheck?.checked;
    const isPXLNFTSelected = tokenSymbolFilter?.value === 'PXLNFT';
    const shouldShow = isNFTEnabled && isPXLNFTSelected;
    if (rarityFilterWrapper) {
        rarityFilterWrapper.style.display = shouldShow ? 'flex' : 'none';
    }
    if (!shouldShow && rarityFilter) {
        rarityFilter.value = 'all';
    }
}

// --- Changelog ---
async function checkChangelog() {
    const currentVersion = getAppVersion();
    const lastSeenVersion = localStorage.getItem('changelog_seen');
    if (lastSeenVersion === currentVersion) return;

    try {
        const response = await fetch('changelog.json');
        const changelog = await response.json();
        const changes = [];
        if (changelog.groups && Array.isArray(changelog.groups)) {
            changelog.groups.forEach(group => {
                if (group.commits && Array.isArray(group.commits)) {
                    group.commits.forEach(commit => {
                        if (commit.subject) changes.push(commit.subject);
                    });
                }
            });
        }
        if (changes.length === 0) {
            localStorage.setItem('changelog_seen', currentVersion);
            return;
        }
        showChangelogModal({
            version: currentVersion,
            date: changelog.date || new Date().toLocaleDateString('ru-RU'),
            changes
        });
        localStorage.setItem('changelog_seen', currentVersion);
    } catch (error) {
        console.error('Ошибка загрузки changelog:', error);
    }
}

function showChangelogModal(entry) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 9999; backdrop-filter: blur(4px);
    `;
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; max-width: 400px; width: 90%; padding: 24px;
        border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        max-height: 80vh; overflow-y: auto;
    `;
    modal.innerHTML = `
        <h2 style="margin: 0 0 4px 0; font-size: 22px;">🔄 Что нового</h2>
        <p style="color: #6b7280; margin: 0 0 16px 0; font-size: 14px;">
            Версия ${entry.version} от ${entry.date}
        </p>
        <ul style="list-style: none; padding: 0; margin: 0 0 20px 0;">
            ${entry.changes.map(text => `
                <li style="padding: 10px 0 10px 24px; border-bottom: 1px solid #f3f4f6;
                    position: relative; font-size: 14px; line-height: 1.4;">
                    <span style="position: absolute; left: 0; top: 10px; color: #4f46e5; font-weight: bold;">•</span>
                    ${text}
                </li>
            `).join('')}
        </ul>
        <button type="button" style="background: #4f46e5; color: white; border: none;
            padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 16px;
            cursor: pointer; width: 100%;">Понятно, спасибо!</button>
    `;
    modal.querySelector('button').addEventListener('click', () => overlay.remove());
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// --- Даты ---
function applyDateFilterHandler() {
    const start = startDateFilter?.value;
    const end = endDateFilter?.value;
    if (start && end && start > end) {
        showStatus('Дата начала не может быть позже даты окончания', 'error');
        return;
    }
    setDateFilter(start || null, end || null);
    if (state.currentAddress) {
        loadHistory(state.currentAddress, tokenTypeFilter?.value || '', false);
    }
}

function clearDateFilterHandler() {
    if (startDateFilter) startDateFilter.value = '';
    if (endDateFilter) endDateFilter.value = '';
    setDateFilter(null, null);
    if (state.currentAddress) {
        loadHistory(state.currentAddress, tokenTypeFilter?.value || '', false);
    }
}

// --- NFT / Sort localStorage ---
function loadNFTCheckboxState() {
    const saved = localStorage.getItem('enableNFT');
    if (enableNFTCheck) {
        enableNFTCheck.checked = saved === 'true';
    }
}

function saveNFTCheckboxState() {
    if (enableNFTCheck) {
        localStorage.setItem('enableNFT', enableNFTCheck.checked);
    }
}

function loadSortOrder() {
    const saved = localStorage.getItem('sortOrder');
    if (saved === 'asc' || saved === 'desc') {
        setSortOrder(saved);
    } else {
        setSortOrder('desc');
    }
    sortRadios.forEach(radio => {
        if (radio.value === state.sortOrder) radio.checked = true;
    });
}

function saveSortOrder() {
    sortRadios.forEach(radio => {
        if (radio.checked) {
            setSortOrder(radio.value);
            localStorage.setItem('sortOrder', state.sortOrder);
        }
    });
    if (state.currentAddress) {
        applySorting();
        doRender(true);
        showStatus(
            `Сортировка обновлена: ${state.sortOrder === 'desc' ? 'новые сверху' : 'старые сверху'}`,
            'info'
        );
    }
}

// --- Загрузка цен + enrich ---
/**
 * @param {{ onlyMissing?: boolean }} opts — при onlyMissing enrich* сами фильтруют по отсутствующим полям
 */
async function loadPricesAndRender(opts = {}) {
    // Сначала имена методов из блокчейна для неизвестных 0x…
    const needNames = state.allTransfers.some(t => {
        const m = getMethod(t);
        return typeof m === 'string' && /^0x[0-9a-fA-F]{8}$/i.test(m);
    });
    if (needNames) {
        await enrichUnknownMethodNames(state.allTransfers);
    }

    state.filteredTransfers = applyFilters(state.allTransfers, collectFilterOptions());
    doRender(true);

    const needPrice = state.filteredTransfers.some(t => {
        const method = getMethod(t);
        return (method === 'executeOrder' || method === 'createOrder') && !t._price;
    });
    if (needPrice) {
        showStatus('Загрузка цен для покупок...', 'info');
        await enrichWithPrices(state.filteredTransfers); // внутри только без _price
        doRender(false);
    }

    const enableSummaryEl = document.getElementById('enableSummary');
    if (enableSummaryEl?.checked) {
        const needStartEnrich = state.filteredTransfers.some(t => {
            return getMethod(t) === 'start' && !t._reservedSGB;
        });
        if (needStartEnrich) {
            showStatus('Загрузка резервирования SGB для Запуск УС...', 'info');
            await enrichStartTransactions(state.filteredTransfers);
            doRender(false);
        }
    }

    const needInternalEnrich = state.allTransfers.some(t => {
        if (!t._isInternal || t._orderDetails) return false;
        const method = getMethod(t);
        return method === 'transfer' || method === 'other' || !method;
    });
    if (needInternalEnrich) {
        showStatus('Определение методов внутренних транзакций...', 'info');
        await enrichInternalTransactions(state.allTransfers);
        state.filteredTransfers = applyFilters(state.allTransfers, collectFilterOptions());
        doRender(true);
    }

    if (enableNFTCheck?.checked) {
        const allNeedNFT = state.allTransfers.some(t => {
            const tokenId = t.total?.token_id || t.token_id || t.tokenId;
            return tokenId && !t._nftData;
        });
        if (allNeedNFT) {
            showStatus('Загрузка данных NFT...', 'info');
            await enrichWithNFTData(state.allTransfers); // внутри только без _nftData
            state.filteredTransfers = applyFilters(state.allTransfers, collectFilterOptions());
            doRender(false);
        }
    }

    // Итоги + статус. Не вызываем onFilterChange() — он сбрасывает currentPage на 1
    // (это нужно только при смене фильтров, не после «Загрузить ещё» / enrich).
    const enableSummaryEl2 = document.getElementById('enableSummary');
    if (enableSummaryEl2?.checked) {
        updateSummary();
    }

    // Если после фильтра страница «вылезла» за пределы — подрезать
    const totalPages = Math.ceil(state.filteredTransfers.length / ITEMS_PER_PAGE) || 1;
    if (state.currentPage > totalPages) {
        state.currentPage = totalPages;
        doRender(false);
    }

    showStatus(`Найдено ${state.filteredTransfers.length} записей.`, 'success');
    playSuccessBeep();
}

// --- loadHistory ---
async function loadHistory(address, tokenType = '', initialLoad = false) {
    address = normalizeAddress(address);
    if (!isValidAddress(address)) {
        showStatus('Некорректный адрес. Нужен формат 0x и 40 символов (0–9, a–f).', 'error');
        return;
    }
    if (state.isLoading) return;

    setCurrentAddress(address);
    setLoading(true);
    if (fetchBtn) fetchBtn.disabled = true;
    showStatus('Загрузка данных... (включая internal транзакции)', 'info');

    try {
        resetTransfersState();

        const dateFilters = {
            dateFilterStart: state.dateFilterStart,
            dateFilterEnd: state.dateFilterEnd
        };

        const [normalData, internalData] = await Promise.all([
            fetchTokenTransfers(address, tokenType, null, dateFilters),
            fetchInternalTransfers(address, tokenType)
        ]);

        state.nextPageParams = {
            normal: normalData.next_page_params || null,
            internal: internalData.next_page_params || null
        };

        const combined = [...(normalData.items || []), ...(internalData.items || [])];
        combined.sort((a, b) => {
            const tsA = new Date(a.timestamp || 0).getTime();
            const tsB = new Date(b.timestamp || 0).getTime();
            return tsB - tsA;
        });

        state.allTransfers = combined;
        state.totalLoadedPages = 1;
        state.allTransfers.forEach(t => getMethod(t));

        const history = saveAddressHistory(address);
        updateDatalist(addressHistoryDatalist, history);

        applySorting();
        state.filteredTransfers = applyFilters(state.allTransfers, collectFilterOptions());
        showStatus(`Загружено ${state.allTransfers.length} записей (включая internal)`, 'success');
    } catch (error) {
        console.error('Ошибка:', error);
        showStatus(`Ошибка загрузки: ${error.message}`, 'error');
        state.allTransfers = [];
        state.filteredTransfers = [];
    } finally {
        setLoading(false);
        if (fetchBtn) fetchBtn.disabled = false;
        await loadPricesAndRender();
    }
}

async function loadMorePages(count = 1, showIndicator = false) {
    if (state.isLoading) return { loaded: 0, totalAdded: 0 };

    setLoading(true);
    if (showIndicator) {
        setLoadMoreButtonLoading(true);
        showLoadingIndicator(true);
    }

    let loaded = 0;
    let totalAdded = 0;
    let currentNextNormal = state.nextPageParams?.normal || null;
    let currentNextInternal = state.nextPageParams?.internal || null;
    const tokenType = tokenTypeFilter?.value || '';

    try {
    while (loaded < count && (currentNextNormal || currentNextInternal)) {
        try {
            let addedInIteration = 0;

            if (currentNextNormal) {
                const dateFilters = {
                    dateFilterStart: state.dateFilterStart,
                    dateFilterEnd: state.dateFilterEnd
                };
                const normalData = await fetchTokenTransfers(
                    state.currentAddress,
                    tokenType,
                    currentNextNormal,
                    dateFilters
                );
                const newNormalItems = normalData.items || [];
                currentNextNormal = normalData.next_page_params || null;
                if (state.nextPageParams) state.nextPageParams.normal = currentNextNormal;

                if (newNormalItems.length > 0) {
                    const existingKeys = new Set(
                        state.allTransfers.map(t => `${t.transaction_hash}-${t.log_index}`)
                    );
                    const uniqueNew = newNormalItems.filter(t => {
                        const key = `${t.transaction_hash}-${t.log_index}`;
                        return !existingKeys.has(key);
                    });
                    if (uniqueNew.length > 0) {
                        uniqueNew.forEach(t => getMethod(t));
                        state.allTransfers = [...state.allTransfers, ...uniqueNew];
                        addedInIteration += uniqueNew.length;
                    }
                }
            }

            const allNormals = state.allTransfers.filter(t => !t._isInternal);
            let lastNormalDate = null;
            if (allNormals.length > 0) {
                const sortedNormals = [...allNormals].sort((a, b) => {
                    const tsA = new Date(a.timestamp || 0).getTime();
                    const tsB = new Date(b.timestamp || 0).getTime();
                    return tsA - tsB;
                });
                lastNormalDate = new Date(sortedNormals[0].timestamp);
            }

            if (lastNormalDate && currentNextInternal) {
                let hasMoreInternal = true;
                let loadedInternal = 0;

                while (hasMoreInternal && currentNextInternal) {
                    const internalData = await fetchInternalTransfers(
                        state.currentAddress,
                        tokenType,
                        currentNextInternal
                    );
                    const newInternalItems = internalData.items || [];
                    currentNextInternal = internalData.next_page_params || null;
                    if (state.nextPageParams) state.nextPageParams.internal = currentNextInternal;

                    if (newInternalItems.length > 0) {
                        const validItems = newInternalItems.filter(t => {
                            const txDate = new Date(t.timestamp || 0);
                            return txDate >= lastNormalDate;
                        });

                        if (validItems.length > 0) {
                            const existingKeys = new Set(
                                state.allTransfers.map(t => `${t.transaction_hash}-${t.log_index}`)
                            );
                            const uniqueNew = validItems.filter(t => {
                                const key = `${t.transaction_hash}-${t.log_index}`;
                                return !existingKeys.has(key);
                            });
                            if (uniqueNew.length > 0) {
                                uniqueNew.forEach(t => getMethod(t));
                                state.allTransfers = [...state.allTransfers, ...uniqueNew];
                                loadedInternal += uniqueNew.length;
                                addedInIteration += uniqueNew.length;
                            }
                        }

                        const anyValid = newInternalItems.some(t => {
                            const txDate = new Date(t.timestamp || 0);
                            return txDate >= lastNormalDate;
                        });
                        if (!anyValid) hasMoreInternal = false;
                    } else {
                        hasMoreInternal = false;
                    }

                    if (loadedInternal > 1000) {
                        console.warn('Слишком много внутренних транзакций, останавливаем');
                        hasMoreInternal = false;
                    }
                }
            }

            totalAdded += addedInIteration;
            applySorting();
            loaded++;
            state.totalLoadedPages++;
        } catch (error) {
            console.error('Ошибка при догрузке:', error);
            showStatus(`Ошибка при догрузке: ${error.message}`, 'error');
            break;
        }
    }

    } finally {
        setLoading(false);
        if (showIndicator) {
            setLoadMoreButtonLoading(false);
            showLoadingIndicator(false);
        }
    }

    if (state.currentAddress) {
        // enrich только новых: loadPricesAndRender сам берёт элементы без _price/_nftData
        state.filteredTransfers = applyFilters(state.allTransfers, collectFilterOptions());
        await loadPricesAndRender({ onlyMissing: true });
    }

    return { loaded, totalAdded };
}

function onFilterChange() {
    if (state.isFilterLoading) return;
    if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = null;
    }
    state.debounceTimer = setTimeout(async () => {
        if (state.isFilterLoading) return;
        setFilterLoading(true);
        state.currentPage = 1;

        try {
            state.filteredTransfers = applyFilters(state.allTransfers, collectFilterOptions());
            doRender(true);

            const enableSummaryEl = document.getElementById('enableSummary');
            if (enableSummaryEl?.checked) {
                updateSummary();
            } else {
                const summaryBody = document.getElementById('summaryBody');
                if (summaryBody) {
                    summaryBody.innerHTML = `<tr><td colspan="4" class="empty-state">Итоги отключены (включите в Advanced)</td></tr>`;
                }
            }

            const needPrice = state.filteredTransfers.some(t => {
                const method = getMethod(t);
                return (method === 'executeOrder' || method === 'createOrder') && !t._price;
            });
            if (needPrice) {
                (async () => {
                    showStatus('Загрузка цен для покупок...', 'info');
                    await enrichWithPrices(state.filteredTransfers);
                    doRender(false);
                })();
            }

            const pageItems = state.filteredTransfers.slice(
                (state.currentPage - 1) * ITEMS_PER_PAGE,
                state.currentPage * ITEMS_PER_PAGE
            );
            if (state.filteredTransfers.length === 0 && state.nextPageParams) {
                showStatus('По вашему фильтру нет записей в загруженных страницах. Нажмите "Загрузить ещё" для поиска.', 'info');
            } else if (state.filteredTransfers.length === 0 && !state.nextPageParams) {
                showStatus('По выбранному фильтру транзакций не найдено во всей истории.', 'info');
            } else if (state.filteredTransfers.length > 0 && pageItems.length < ITEMS_PER_PAGE && state.nextPageParams) {
                showStatus(`Показано ${state.filteredTransfers.length} записей. Нажмите "Загрузить ещё" для загрузки следующих страниц.`, 'info');
            } else {
                showStatus(`Найдено ${state.filteredTransfers.length} записей.`, 'success');
            }
        } finally {
            setFilterLoading(false);
            state.debounceTimer = null;
        }
    }, DEBOUNCE_DELAY);
}

function goToPage(page) {
    const totalPages = Math.ceil(state.filteredTransfers.length / ITEMS_PER_PAGE) || 1;
    if (page < 1 || page > totalPages || page === state.currentPage) return;
    state.currentPage = page;
    doRender(false);
}

function goToFirstPage() { goToPage(1); }
function goToLastPage() {
    const totalPages = Math.ceil(state.filteredTransfers.length / ITEMS_PER_PAGE) || 1;
    goToPage(totalPages);
}
function goToPrevPage() { goToPage(state.currentPage - 1); }
function goToNextPage() { goToPage(state.currentPage + 1); }

async function loadMoreHandler() {
    if (!(state.nextPageParams?.normal || state.nextPageParams?.internal) || state.isLoading) return;
    try {
        const previousLength = state.allTransfers.length;
        const result = await loadMorePages(1, true);
        if (result.loaded > 0 || result.totalAdded > 0) {
            const added = state.allTransfers.length - previousLength;
            showStatus(`Загружено ещё ${added} записей. Всего: ${state.allTransfers.length}`, 'success');
            // бип уже в loadPricesAndRender
        } else {
            showStatus('Больше данных нет', 'info');
        }
    } catch (error) {
        showStatus(`Ошибка догрузки: ${error.message}`, 'error');
    }
}

// --- Clear cache ---
document.getElementById('clearCacheBtn')?.addEventListener('click', async () => {
    try {
        setLoading(false);
        showStatus('Обновление приложения...', 'info');
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
        if (isHttp && 'serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                }
            } catch (error) {
                console.warn('Не удалось отключить Service Worker:', error);
            }
        }
        window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    } catch (error) {
        console.error('Ошибка обновления:', error);
        showStatus('Ошибка обновления. Попробуйте очистить кэш вручную.', 'error');
    }
});

// --- UI: filters collapse ---
function toggleFilters() {
    if (!filtersContent || !filtersToggle) return;
    const isCollapsed = filtersContent.classList.toggle('collapsed');
    filtersToggle.classList.toggle('collapsed');
    localStorage.setItem('filtersCollapsed', isCollapsed);
}

if (localStorage.getItem('filtersCollapsed') === 'true') {
    filtersContent?.classList.add('collapsed');
    filtersToggle?.classList.add('collapsed');
}

filtersHeader?.addEventListener('click', (e) => {
    if (e.target.closest('.filters-toggle')) return;
    toggleFilters();
});
filtersToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFilters();
});

// --- Events ---
enableNFTCheck?.addEventListener('change', function () {
    saveNFTCheckboxState();
    updateRarityFilterVisibility();
    if (this.checked && state.currentAddress) {
        loadPricesAndRender();
    } else if (!this.checked && state.currentAddress) {
        doRender(true);
    }
});

rarityFilter?.addEventListener('change', onFilterChange);

fetchBtn?.addEventListener('click', () => {
    const address = normalizeAddress(addressInput?.value || '');
    if (!isValidAddress(address)) {
        addressInput?.classList.add('input-invalid');
        showStatus('Некорректный адрес. Нужен формат 0x и 40 символов (0–9, a–f).', 'error');
        return;
    }
    addressInput?.classList.remove('input-invalid');
    loadHistory(address, tokenTypeFilter?.value || '', false);
});

applyDateFilterBtn?.addEventListener('click', applyDateFilterHandler);
clearDateFilterBtn?.addEventListener('click', clearDateFilterHandler);
startDateFilter?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyDateFilterHandler();
});
endDateFilter?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyDateFilterHandler();
});
addressInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchBtn?.click();
});

// Кнопка очистки адреса (чтобы открыть datalist с историей)
const clearAddressBtn = document.getElementById('clearAddressBtn');

function syncClearAddressBtn() {
    if (!clearAddressBtn || !addressInput) return;
    const hasValue = Boolean(addressInput.value.trim());
    clearAddressBtn.hidden = !hasValue;
}

clearAddressBtn?.addEventListener('click', () => {
    if (!addressInput) return;
    addressInput.value = '';
    addressInput.classList.remove('input-invalid');
    syncClearAddressBtn();
    addressInput.focus();
    // небольшой трюк: открыть подсказки datalist после очистки
    try {
        addressInput.click();
    } catch (_) { /* ignore */ }
});

addressInput?.addEventListener('input', () => {
    addressInput.classList.remove('input-invalid');
    syncClearAddressBtn();
});

syncClearAddressBtn();

sortRadios.forEach(radio => {
    radio.addEventListener('change', saveSortOrder);
});

showIncomingCheck?.addEventListener('change', onFilterChange);
showOnlyOutgoingCheck?.addEventListener('change', onFilterChange);
tokenSymbolFilter?.addEventListener('change', () => {
    updateRarityFilterVisibility();
    onFilterChange();
});

methodCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function () {
        const method = this.dataset.method;
        if (method === 'all') {
            if (this.checked) {
                methodCheckboxes.forEach(cb => {
                    if (cb.dataset.method !== 'all') cb.checked = false;
                });
            }
        } else {
            const allCheckbox = document.querySelector('.method-checkbox[data-method="all"]');
            if (allCheckbox) allCheckbox.checked = false;
            const anySelected = Array.from(methodCheckboxes).some(cb =>
                cb.dataset.method !== 'all' && cb.checked
            );
            if (!anySelected && allCheckbox) allCheckbox.checked = true;
        }

        const startCheckbox = document.querySelector('.method-checkbox[data-method="start"]');
        const claimForUserCheckbox = document.querySelector('.method-checkbox[data-method="claimForUser"]');
        if (method === 'start' && startCheckbox?.checked && claimForUserCheckbox) {
            claimForUserCheckbox.checked = true;
        }
        onFilterChange();
    });
});

firstPageBtns.forEach(btn => btn.addEventListener('click', goToFirstPage));
prevPageBtns.forEach(btn => btn.addEventListener('click', goToPrevPage));
nextPageBtns.forEach(btn => btn.addEventListener('click', goToNextPage));
lastPageBtns.forEach(btn => btn.addEventListener('click', goToLastPage));
loadMoreBtns.forEach(btn => btn.addEventListener('click', loadMoreHandler));

// --- Summary collapse ---
const summaryHeader = document.getElementById('summaryHeader');
const summaryToggle = document.getElementById('summaryToggle');
const summaryContent = document.getElementById('summaryContent');

if (localStorage.getItem('summaryCollapsed') === 'true') {
    summaryContent?.classList.add('collapsed');
    summaryToggle?.classList.add('collapsed');
}

function toggleSummary() {
    if (!summaryContent || !summaryToggle) return;
    const isCollapsed = summaryContent.classList.toggle('collapsed');
    summaryToggle.classList.toggle('collapsed');
    localStorage.setItem('summaryCollapsed', isCollapsed);
}

summaryHeader?.addEventListener('click', (e) => {
    if (e.target.closest('.summary-toggle')) return;
    toggleSummary();
});
summaryToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSummary();
});

const enableSummary = document.getElementById('enableSummary');
if (enableSummary) {
    const saved = localStorage.getItem('enableSummary');
    if (saved !== null) enableSummary.checked = saved === 'true';
}

const enableSoundCheck = document.getElementById('enableSound');
if (enableSoundCheck) {
    const savedSound = localStorage.getItem('enableSound');
    // по умолчанию включён
    if (savedSound !== null) enableSoundCheck.checked = savedSound === 'true';
    enableSoundCheck.addEventListener('change', () => {
        localStorage.setItem('enableSound', enableSoundCheck.checked);
    });
}

enableSummary?.addEventListener('change', async function () {
    localStorage.setItem('enableSummary', this.checked);
    if (this.checked) {
        const needStartEnrich = state.filteredTransfers.some(t => {
            return getMethod(t) === 'start' && !t._reservedSGB;
        });
        if (needStartEnrich) {
            showStatus('Загрузка резервирования SGB для Запуск УС...', 'info');
            await enrichStartTransactions(state.filteredTransfers);
            doRender(false);
        }
        updateSummary();
    } else {
        const summaryBody = document.getElementById('summaryBody');
        if (summaryBody) {
            summaryBody.innerHTML = `<tr><td colspan="4" class="empty-state">Итоги отключены (включите в Advanced)</td></tr>`;
        }
    }
});

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    // Group toggles
    const groupHeaders = document.querySelectorAll('.group-header');
    function toggleGroup(groupHeader) {
        const content = groupHeader.nextElementSibling;
        const toggle = groupHeader.querySelector('.group-toggle');
        if (content) {
            content.classList.toggle('collapsed');
            if (toggle) toggle.classList.toggle('collapsed');
            const groupId = groupHeader.dataset.group;
            if (groupId) {
                localStorage.setItem(`group_${groupId}`, content.classList.contains('collapsed'));
            }
        }
    }
    groupHeaders.forEach(header => {
        const groupId = header.dataset.group;
        if (groupId && localStorage.getItem(`group_${groupId}`) === 'true') {
            const content = header.nextElementSibling;
            const toggle = header.querySelector('.group-toggle');
            if (content) content.classList.add('collapsed');
            if (toggle) toggle.classList.add('collapsed');
        }
        header.addEventListener('click', function (e) {
            if (e.target.closest('label')) return;
            toggleGroup(this);
        });
    });

    // Address from URL or history
    const urlParams = new URLSearchParams(window.location.search);
    const addressParam = urlParams.get('address');

    if (addressParam && isValidAddress(addressParam)) {
        const safeAddr = normalizeAddress(addressParam);
        saveAddressHistory(safeAddr);
        if (addressInput) addressInput.value = safeAddr;
        loadHistory(safeAddr, tokenTypeFilter?.value || '', true);
        showStatus(`Загрузка данных для адреса ${safeAddr}...`, 'info');
    } else {
        const history = loadAddressHistory();
        updateDatalist(addressHistoryDatalist, history);
        if (history.length > 0) {
            const lastAddress = history[0];
            if (addressInput) addressInput.value = lastAddress;
            loadHistory(lastAddress, '', true);
        } else {
            if (addressInput) addressInput.value = '';
            showStatus('Введите адрес кошелька и нажмите "Получить историю"', 'info');
        }
    }

    loadSortOrder();
    loadNFTCheckboxState();
    updateRarityFilterVisibility();
    checkChangelog();

    const label = document.getElementById('networkTokenLabel');
    if (label) label.textContent = NETWORK_TOKEN;

    // Internal / Normal filters
    const internalCheck = document.getElementById('showOnlyInternal');
    const normalCheck = document.getElementById('showOnlyNormal');
    if (internalCheck && normalCheck) {
        const newInternal = internalCheck.cloneNode(true);
        const newNormal = normalCheck.cloneNode(true);
        internalCheck.parentNode.replaceChild(newInternal, internalCheck);
        normalCheck.parentNode.replaceChild(newNormal, normalCheck);

        newInternal.addEventListener('change', function () {
            if (this.checked && newNormal) newNormal.checked = false;
            onFilterChange();
        });
        newNormal.addEventListener('change', function () {
            if (this.checked && newInternal) newInternal.checked = false;
            onFilterChange();
        });
    }
});
