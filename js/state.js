/**
 * state.js — Централизованное состояние приложения
 * Простой mutable-объект + функции обновления.
 * Не использует реактивность — достаточно для vanilla JS.
 */

export const state = {
    currentAddress: '',
    allTransfers: [],
    filteredTransfers: [],
    currentPage: 1,
    nextPageParams: null,
    isLoading: false,
    isFilterLoading: false,
    totalLoadedPages: 0,
    debounceTimer: null,
    dateFilterStart: null,   // 'YYYY-MM-DD' | null
    dateFilterEnd: null,
    sortOrder: 'desc'        // 'desc' | 'asc'
};

/** Сброс состояния при новой загрузке адреса */
export function resetTransfersState() {
    state.allTransfers = [];
    state.filteredTransfers = [];
    state.currentPage = 1;
    state.nextPageParams = null;
    state.totalLoadedPages = 0;
}

export function setCurrentAddress(address) {
    state.currentAddress = address || '';
}

export function setLoading(value) {
    state.isLoading = Boolean(value);
}

export function setFilterLoading(value) {
    state.isFilterLoading = Boolean(value);
}

export function setSortOrder(order) {
    if (order === 'asc' || order === 'desc') {
        state.sortOrder = order;
    }
}

export function setDateFilter(start, end) {
    state.dateFilterStart = start || null;
    state.dateFilterEnd = end || null;
}
