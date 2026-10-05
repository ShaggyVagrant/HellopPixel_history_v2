/**
 * enrichment.js — Обогащение транзакций (цены, NFT, internal, start)
 */

import { getMethod } from './method-detector.js';
import {
    fetchTransactionDetails,
    fetchTransactionPrice,
    fetchNFTData
} from './api.js';

/**
 * Параллельная загрузка цен для executeOrder / createOrder (пачками).
 * @param {object[]} transfers
 */
export async function enrichWithPrices(transfers) {
    const orders = transfers.filter(t => {
        const method = getMethod(t);
        return method === 'executeOrder' || method === 'createOrder';
    });
    if (orders.length === 0) return;

    const chunkSize = 5;
    for (let i = 0; i < orders.length; i += chunkSize) {
        const chunk = orders.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (tx) => {
            if (!tx._price) {
                const method = getMethod(tx);
                const price = await fetchTransactionPrice(tx.transaction_hash, method);
                tx._price = price !== null ? price : '—';
            }
        }));
    }
}

/**
 * Обогащение NFT-данными.
 * @param {object[]} transfers
 */
export async function enrichWithNFTData(transfers) {
    const needNFT = transfers.filter(t => {
        const tokenId = t.total?.token_id || t.token_id || t.tokenId || t._orderDetails?.tokenId;
        return tokenId && !t._nftData;
    });

    if (needNFT.length === 0) return;

    const chunkSize = 4;
    for (let i = 0; i < needNFT.length; i += chunkSize) {
        const chunk = needNFT.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (tx) => {
            const tokenId = tx.total?.token_id || tx.token_id || tx.tokenId || tx._orderDetails?.tokenId;
            if (!tokenId) return;
            const nftData = await fetchNFTData(tokenId);
            if (nftData) {
                tx._nftData = nftData;
                if (nftData.imageUrl) {
                    if (!tx.total) tx.total = {};
                    if (!tx.total.token_instance) tx.total.token_instance = {};
                    tx.total.token_instance.image_url = nftData.imageUrl;
                    tx.total.token_instance.name = nftData.name || '';
                }
            }
        }));
        // пауза между пачками, чтобы не долбить RPC
        if (i + chunkSize < needNFT.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}

/**
 * Обогащение start-транзакций (резерв SGB).
 * @param {object[]} transfers
 */
export async function enrichStartTransactions(transfers) {
    const starts = transfers.filter(t => {
        const method = getMethod(t);
        return method === 'start' && !t._reservedSGB;
    });

    if (starts.length === 0) return;

    for (const tx of starts) {
        try {
            const details = await fetchTransactionDetails(tx.transaction_hash);
            if (details && details.value) {
                const reservedSGB = parseFloat(details.value) / 1e18;
                tx._reservedSGB = reservedSGB;
                tx._price = reservedSGB;
            }
        } catch (e) {
            console.error(`Ошибка обогащения start ${tx.transaction_hash}:`, e);
        }
    }
}

/**
 * Обогащение internal-транзакций (executeOrderInternal, stop, start, claimForUser).
 * @param {object[]} transfers
 */
export async function enrichInternalTransactions(transfers) {
    const internalTxs = transfers.filter(t => {
        if (!t._isInternal || t._orderDetails) return false;
        const method = getMethod(t);
        return method === 'transfer' || method === 'other' || !method;
    });

    if (internalTxs.length === 0) return;

    const chunkSize = 5;
    for (let i = 0; i < internalTxs.length; i += chunkSize) {
        const chunk = internalTxs.slice(i, i + chunkSize);

        await Promise.all(chunk.map(async (tx) => {
            try {
                const details = await fetchTransactionDetails(tx.transaction_hash);
                if (!details || !details.decoded_input) return;

                const methodName = details.decoded_input.method_call || '';
                const signature = (details.decoded_input.method_id || '').toLowerCase();

                // executeOrder (Продан на рынке)
                if (methodName.includes('executeOrder') || signature === 'ae7b0333') {
                    const params = details.decoded_input.parameters || [];
                    tx._orderDetails = {
                        method: 'executeOrderInternal',
                        tokenId: params.find(p => p.name === 'assetId')?.value,
                        seller: params.find(p => p.name === 'seller')?.value,
                        orderId: params.find(p => p.name === 'orderId')?.value,
                        priceInWei: params.find(p => p.name === 'price')?.value,
                    };
                    tx._detectedMethod = 'executeOrderInternal';
                    return;
                }

                // stop
                if (signature === '07da68f5' || methodName.includes('stop')) {
                    const rawAmount = parseFloat(tx.total?.value || 0);
                    if (!isNaN(rawAmount) && rawAmount > 0) {
                        tx._stopReturn = rawAmount / 1e18;
                        tx._price = rawAmount / 1e18;
                    }
                    if (tx.total) {
                        tx.total.value = '0';
                    }
                    tx.value = '0';
                    tx._detectedMethod = 'stop';
                    return;
                }

                // start
                if (signature === '95805dad' || methodName.includes('start')) {
                    tx._detectedMethod = 'start';
                    return;
                }

                // claimForUser
                if (signature === '42b0f52f' || methodName.includes('claimForUser')) {
                    tx._detectedMethod = 'claimForUser';
                    return;
                }
            } catch (e) {
                console.error(`Ошибка обогащения внутренней транзакции ${tx.transaction_hash}:`, e);
            }
        }));
    }
}


/**
 * Для транзакций, у которых method всё ещё 0x… — тянем decoded_input с Explorer
 * и подставляем имя функции (claimFreeChest, buySizeLevel, …).
 * @param {object[]} transfers
 */
export async function enrichUnknownMethodNames(transfers) {
    const unknown = transfers.filter(t => {
        const m = getMethod(t);
        return typeof m === 'string' && /^0x[0-9a-fA-F]{8}$/i.test(m) && t.transaction_hash;
    });
    if (unknown.length === 0) return;

    const chunkSize = 5;
    for (let i = 0; i < unknown.length; i += chunkSize) {
        const chunk = unknown.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (tx) => {
            try {
                const details = await fetchTransactionDetails(tx.transaction_hash);
                if (!details?.decoded_input) return;

                let name = details.decoded_input.method_call || '';
                // "claimFreeChest(uint64 userId)" → "claimFreeChest"
                const paren = name.indexOf('(');
                if (paren > 0) name = name.slice(0, paren).trim();
                if (!name) {
                    const mid = details.decoded_input.method_id;
                    if (mid) {
                        const sig = mid.startsWith('0x') ? mid : `0x${mid}`;
                        // оставляем как есть, если имени нет
                        return;
                    }
                    return;
                }

                tx.method = name;
                tx.method_name = name;
                tx._detectedMethod = name;
            } catch (e) {
                console.error(`Не удалось получить имя метода для ${tx.transaction_hash}:`, e);
            }
        }));
    }
}
