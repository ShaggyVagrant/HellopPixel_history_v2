/**
 * api.js — Сетевые запросы к Songbird Explorer API и NFT-контракту
 */

import {
    API_BASE_URL,
    NETWORK_TOKEN,
    ITEMS_PER_PAGE,
    CONFIG,
    resolveSignature
} from './config.js';

/**
 * Если API вернул method как сигнатуру 0x… — заменить на имя из SIGNATURES.
 * @param {string|null} method
 * @returns {string|null}
 */
function resolveMethodName(method) {
    if (!method || typeof method !== 'string') return method || null;
    const resolved = resolveSignature(method);
    return resolved || method;
}

/**
 * fetch с повторами при 429/5xx.
 * @param {string|URL} url
 * @param {RequestInit} options
 * @param {{ retries?: number, delayMs?: number }} retry
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retry = {}) {
    const retries = retry.retries ?? 2;
    const delayMs = retry.delayMs ?? 800;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;

            const retriable = response.status === 429 || response.status >= 500;
            if (!retriable || attempt === retries) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Ошибка ${response.status}: ${errorText || response.statusText}`);
            }
            lastError = new Error(`Ошибка ${response.status}`);
            await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        } catch (e) {
            lastError = e;
            if (attempt === retries) throw e;
            await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        }
    }
    throw lastError || new Error('Сетевая ошибка');
}

/**
 * Нормализация элемента из advanced-filters.
 * @param {object} item
 * @returns {object}
 */
export function normalizeAdvancedFilterItem(item) {
    const method = resolveMethodName(item.method || null);
    return {
        transaction_hash: item.hash,
        timestamp: item.timestamp,
        block_number: item.block_number,
        log_index: item.token_transfer_index ?? item.transaction_index ?? 0,
        from: item.from,
        to: item.to,
        token: item.token ? {
            ...item.token,
            type: item.token.type || item.type,
            symbol: item.token.symbol,
            name: item.token.name,
            decimals: item.token.decimals,
            address: item.token.address_hash || item.token.address
        } : null,
        total: item.total,
        token_type: item.type,
        method,
        method_name: method
    };
}

/**
 * Добавляет pageParams в URL.
 * null → пустая строка (важно для advanced-filters).
 * @param {URL} url
 * @param {object|null} pageParams
 */
export function appendPageParams(url, pageParams) {
    if (!pageParams) return;
    for (const [key, value] of Object.entries(pageParams)) {
        if (value === null || value === undefined) {
            url.searchParams.append(key, '');
        } else {
            url.searchParams.append(key, value);
        }
    }
}

/**
 * Загрузка token-transfers (или advanced-filters при фильтре по дате).
 * @param {string} address
 * @param {string} tokenType
 * @param {object|null} pageParams
 * @param {{ dateFilterStart: string|null, dateFilterEnd: string|null }} dateFilters
 * @returns {Promise<{items: array, next_page_params: object|null}>}
 */
export async function fetchTokenTransfers(address, tokenType = '', pageParams = null, dateFilters = {}) {
    const { dateFilterStart = null, dateFilterEnd = null } = dateFilters;
    const hasDateFilter = !!(dateFilterStart || dateFilterEnd);

    if (hasDateFilter) {
        const url = new URL(`${API_BASE_URL}/advanced-filters`);

        let types = 'ERC-20,ERC-721,ERC-1155';
        if (tokenType) types = tokenType;
        url.searchParams.append('transaction_types', types);

        url.searchParams.append('from_address_hashes_to_include', address);
        url.searchParams.append('to_address_hashes_to_include', address);
        url.searchParams.append('address_relation', 'or');

        if (dateFilterStart) {
            const startDate = new Date(dateFilterStart + 'T00:00:00');
            url.searchParams.append('age_from', startDate.toISOString());
        }
        if (dateFilterEnd) {
            const endDate = new Date(dateFilterEnd + 'T23:59:59');
            url.searchParams.append('age_to', endDate.toISOString());
        }

        appendPageParams(url, pageParams);
        url.searchParams.set('items_count', pageParams?.items_count || 50);

        const response = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
        const data = await response.json();
        return {
            items: (data.items || []).map(normalizeAdvancedFilterItem),
            next_page_params: data.next_page_params || null
        };
    }

    // Без дат — стандартный эндпоинт
    const url = new URL(`${API_BASE_URL}/addresses/${address}/token-transfers`);
    if (tokenType) url.searchParams.append('type', tokenType);
    appendPageParams(url, pageParams);
    url.searchParams.append('items_count', ITEMS_PER_PAGE);

    const response = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
    const data = await response.json();
    // API часто отдаёт method как 0x… — сразу в имя
    const items = (data.items || []).map(item => ({
        ...item,
        method: resolveMethodName(item.method),
        method_name: resolveMethodName(item.method || item.method_name)
    }));
    return {
        items,
        next_page_params: data.next_page_params || null
    };
}

/**
 * Загрузка internal-транзакций.
 * @param {string} address
 * @param {string} tokenType
 * @param {object|null} pageParams
 * @returns {Promise<{items: array, next_page_params: object|null}>}
 */
export async function fetchInternalTransfers(address, tokenType = '', pageParams = null) {
    const url = new URL(`${API_BASE_URL}/addresses/${address}/internal-transactions`);

    if (pageParams) {
        for (const [key, value] of Object.entries(pageParams)) {
            if (value !== null && value !== undefined) {
                url.searchParams.append(key, value);
            }
        }
    }

    url.searchParams.append('items_count', ITEMS_PER_PAGE);

    const response = await fetchWithRetry(url, {
        headers: { 'Accept': 'application/json' }
    });

    const data = await response.json();

    const normalizedItems = (data.items || []).map(item => {
        const internalIndex = item.index ?? item.log_index ?? item.transaction_index ?? 0;
        const rawValue = item.value || '0';
        const hasNativeValue = parseFloat(rawValue) > 0;
        const method = resolveMethodName(item.method || 'transfer');

        return {
            transaction_hash: item.transaction_hash || item.hash,
            timestamp: item.timestamp || item.block_timestamp,
            block_number: item.block_number,
            log_index: internalIndex,
            from: item.from,
            to: item.to,
            token: item.token
                ? {
                    ...item.token,
                    type: item.token.type || 'ERC-20',
                    symbol: item.token.symbol || '',
                    name: item.token.name || '',
                    decimals: item.token.decimals ?? 18,
                    address: item.token.address || item.token.address_hash
                }
                : null,
            total: item.total || { value: rawValue },
            value: rawValue,
            token_type: hasNativeValue ? 'native' : (item.type || 'call'),
            method,
            method_name: method,
            _isInternal: true,
            _parentTxHash: item.transaction_hash || item.hash,
            _internalIndex: internalIndex,
            _success: item.success !== false,
            _error: item.error || null
        };
    });

    return {
        items: normalizedItems,
        next_page_params: data.next_page_params || null
    };
}

/**
 * Детали транзакции.
 * @param {string} txHash
 * @returns {Promise<object|null>}
 */
export async function fetchTransactionDetails(txHash) {
    try {
        const url = `${API_BASE_URL}/transactions/${txHash}`;
        const response = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
        return await response.json();
    } catch (e) {
        console.error(`Ошибка при получении деталей для ${txHash}:`, e);
        return null;
    }
}

/**
 * Цена для executeOrder / createOrder.
 * @param {string} txHash
 * @param {string} method
 * @returns {Promise<string|null>}
 */
export async function fetchTransactionPrice(txHash, method) {
    try {
        const url = `${API_BASE_URL}/transactions/${txHash}`;
        const response = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
        const data = await response.json();
        if (data.decoded_input && data.decoded_input.parameters) {
            const priceParamName = method === 'createOrder' ? 'priceInWei' : 'price';
            const priceParam = data.decoded_input.parameters.find(p => p.name === priceParamName);
            if (priceParam && priceParam.value) {
                const num = parseFloat(priceParam.value);
                if (!isNaN(num)) {
                    return (num / 1e18).toFixed(6);
                }
            }
        }
        return null;
    } catch (e) {
        console.error(`Ошибка при получении цены для ${txHash}:`, e);
        return null;
    }
}

/**
 * Данные NFT из контракта (Web3).
 * @param {string|number} tokenId
 * @param {string} network
 * @returns {Promise<object|null>}
 */
export async function fetchNFTData(tokenId, network = 'songbird') {
    try {
        const rpcUrl = network === 'songbird'
            ? 'https://songbird-api.flare.network/ext/bc/C/rpc'
            : 'https://mainnet.skalenodes.com/v1/elated-tan-skat';

        const contractAddress = network === 'songbird'
            ? '0x41a7435EF2CBd77df7C6966Af4E62a9B12416398'
            : '0xcB48dF8e2FE472D8Be277348683bBD401Cab6201';

        if (typeof Web3 === 'undefined' || !window.pixelNFTABI) {
            console.warn('Web3 или pixelNFTABI недоступны');
            return null;
        }

        const web3 = new Web3(rpcUrl);
        const contract = new web3.eth.Contract(window.pixelNFTABI, contractAddress);

        // getTokenType + collections достаточно для таблицы (редкость, картинка).
        // ownerOf для сожжённых/несуществующих токенов кидает ERC721NonexistentToken —
        // web3 всё равно пишет в консоль, поэтому не вызываем.
        const NFT_data = await contract.methods.getTokenType(tokenId).call();
        const collections = await contract.methods.getCollections().call();
        const collectionName = collections[NFT_data.collectionId] || 'Unknown';

        let imageUrl = NFT_data.tokenURI || '';
        if (imageUrl && imageUrl.includes('gateway.dedrive.io/v1/access/')) {
            const urlParts = imageUrl.split('/');
            const hash = urlParts[urlParts.length - 1];
            imageUrl = `https://storage.hellopixel.network/nft/dedrive/${hash}.png`;
        }

        return {
            ...NFT_data,
            collectionName,
            ownerAddress: null,
            imageUrl,
            rarity: Number(NFT_data.rarity),
            tokenId: String(tokenId)
        };
    } catch (error) {
        // Тихо: токен мог быть сожжён / нет в контракте
        return null;
    }
}
