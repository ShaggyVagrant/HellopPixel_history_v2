/**
 * Pixel NFT Viewer — логика страницы NFT_1.html
 */

let web3;
let contract;
let collections;
let contractAddress;
/** Кеш инициализации по сети: songbird | skale */
let cachedNetwork = null;

const rarityArray = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** parameterId → человекочитаемое имя (единый источник вместо switch + NFTparam) */
const PARAM_NAMES = {
    '0': 'Drill Speed',
    '1': 'Storage capacity',
    '2': 'Referral storage capacity',
    '3': 'PXLs в час',
    '4': 'Storage fixed capacity',
    '5': 'Referral storage fixed capacity',
    '6': 'Drill upgrade discount',
    '7': 'Storage upgrade discount',
    '8': 'Referral storage upgrade discount',
    '16': 'Second miner speed',
    '17': 'Market commission order discount',
    '20': 'Transaction cost markup',
    '21': 'Dust per Hour',
    '22': 'Mission Duration',
    '23': 'Missions count',
    '25': 'Mission Reward',
    '26': 'Mission Duration Bonus',
    '28': 'Live Time',
    '33': 'Reduce cycle',
    '34': 'Missions count',
    '35': 'Consume Xeno-Paste',
    '36': 'Live Time'
};

function getParameterName(parameterId) {
    const key = String(parameterId);
    return PARAM_NAMES[key] || key;
}

/**
 * Инициализация Web3. Повторный вызов с той же сетью — no-op.
 */
async function initWeb3() {
    const network = document.querySelector('input[name="network"]:checked')?.value || 'songbird';
    if (cachedNetwork === network && contract && collections) {
        return;
    }

    let rpcUrl;
    if (network === 'skale') {
        rpcUrl = 'https://mainnet.skalenodes.com/v1/elated-tan-skat';
        contractAddress = '0xcB48dF8e2FE472D8Be277348683bBD401Cab6201';
    } else {
        rpcUrl = 'https://songbird-api.flare.network/ext/bc/C/rpc';
        contractAddress = '0x41a7435EF2CBd77df7C6966Af4E62a9B12416398';
    }

    if (typeof Web3 === 'undefined' || !window.pixelNFTABI) {
        throw new Error('Web3 или ABI недоступны');
    }

    web3 = new Web3(rpcUrl);
    contract = new web3.eth.Contract(window.pixelNFTABI, contractAddress);
    collections = await contract.methods.getCollections().call();
    cachedNetwork = network;
}

/** Сброс кеша при смене сети */
function onNetworkChange() {
    cachedNetwork = null;
}

function processVariants(variants) {
    if (!variants || !Array.isArray(variants)) {
        return [];
    }

    return variants.map(variantArray =>
        (Array.isArray(variantArray) ? variantArray : []).map(variant => {
            const parameterId = variant.parameterId.toString();
            const mul = Number(variant.mul);
            const add = variant.add.toString();

            let processedMul = mul;
            if (mul !== 0) {
                processedMul = ((mul - 10000) / 100).toFixed(2);
            }

            let processedAdd = add;
            switch (parameterId) {
                case '3':
                    processedAdd = (Number(add) / 277777777777775).toFixed(2);
                    break;
                case '4':
                case '5':
                case '21':
                    processedAdd = (Number(add) / (10 ** 18)).toString();
                    break;
                case '22':
                    processedAdd = Math.floor(Number(add) / 3600).toString();
                    break;
                case '25':
                    processedAdd = ((Number(add) - 10000) / 100).toFixed(2);
                    break;
                case '26':
                    processedAdd = ((Number(add) - 10000) / 100).toFixed(0);
                    break;
                case '36': {
                    const time1 = Number(add) / 3600;
                    const h = Math.floor(time1);
                    const m = ((time1 - h) * 60).toFixed(0);
                    processedAdd = h + ' hour ' + m + ' min';
                    break;
                }
                default:
                    break;
            }

            return {
                parameterId,
                mul: processedMul,
                add: processedAdd
            };
        })
    );
}

/** Приводит значение web3 (BN / bigint / Result) к примитиву */
function toPlain(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'boolean' || typeof value === 'string') return value;
    if (typeof value === 'number') return value;
    // BN.js / web3.utils.BN
    if (typeof value === 'object' && typeof value.toString === 'function' &&
        (value.constructor?.name === 'BN' || value._isBigNumber || value.lt)) {
        return value.toString();
    }
    return value;
}

async function fetchNFTData(tokenId) {
    await initWeb3();
    const raw = await contract.methods.getTokenType(tokenId).call();

    // Явно читаем поля структуры ItemType (не JSON.stringify — он теряет имена у web3 Result)
    const typeId = toPlain(raw.typeId ?? raw[0]);
    const variantsRaw = raw.variants ?? raw[1];
    const tokenURI = toPlain(raw.tokenURI ?? raw[2]) || '';
    const name = toPlain(raw.name ?? raw[3]) || '';
    const slots = raw.slots ?? raw[4] ?? [];
    const collectionId = toPlain(raw.collectionId ?? raw[5]);
    const rarity = toPlain(raw.rarity ?? raw[6]);
    const soulbound = raw.soulbound ?? raw[7];
    const disposable = raw.disposable ?? raw[8];

    const collectionName = collections[collectionId] || collections[Number(collectionId)] || 'Unknown';

    let ownerAddress = null;
    try {
        ownerAddress = await contract.methods.ownerOf(tokenId).call();
        if (ownerAddress === '0x0000000000000000000000000000000000000000') {
            ownerAddress = null;
        }
    } catch (_) {
        ownerAddress = null;
    }

    const processedVariants = processVariants(variantsRaw);

    return {
        typeId,
        variants: processedVariants,
        tokenURI,
        name,
        slots: Array.isArray(slots) ? slots.map(toPlain) : slots,
        collectionId,
        rarity,
        soulbound: Boolean(soulbound),
        disposable: Boolean(disposable),
        collectionName,
        tokenId: String(tokenId),
        ownerAddress
    };
}

function displayNFTInfo(NFT_data) {
    const NFT_data_safe = NFT_data || {};
    const network = document.querySelector('input[name="network"]:checked')?.value || 'songbird';
    const variants = NFT_data_safe.variants || [];

    const formattedVariants = variants
        .map(variantArray =>
            (Array.isArray(variantArray) ? variantArray : [])
                .map(variant => {
                    const parameterName = getParameterName(variant.parameterId);
                    let valueDisplay = '';

                    const mulValue = parseFloat(variant.mul);
                    if (mulValue !== 0 && !isNaN(mulValue)) {
                        const color = mulValue > 0 ? 'rgb(7, 170, 52)' : 'rgb(230, 32, 88)';
                        valueDisplay += `<span style="color: ${color}">${variant.mul}%</span>`;
                    }

                    if (variant.add && variant.add !== '0' && variant.add !== '') {
                        const addValue = parseFloat(variant.add);
                        if (!isNaN(addValue) && addValue !== 0) {
                            const color = addValue > 0 ? 'rgb(7, 170, 52)' : 'rgb(230, 32, 88)';
                            let addText = variant.add;
                            if (variant.parameterId === '21') {
                                addText = `${variant.add} пыли в час`;
                            } else if (variant.parameterId === '22') {
                                addText = `${variant.add} часов`;
                            } else if (['4', '5'].includes(variant.parameterId)) {
                                addText = `${variant.add} PXLs`;
                            }
                            if (valueDisplay) valueDisplay += ' ';
                            valueDisplay += `<span style="color: ${color}">${addText}</span>`;
                        }
                    }

                    if (!valueDisplay) {
                        valueDisplay = '<span style="color: rgb(126, 161, 202)">—</span>';
                    }

                    return `
                        <div style="display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid rgba(126, 161, 202, 0.08);">
                            <span style="color: rgb(126, 161, 202);">${parameterName}</span>
                            <span style="text-align: right;">${valueDisplay}</span>
                        </div>
                    `;
                })
                .join('')
        )
        .join('');

    let transactionLink = '';
    if (network === 'skale') {
        transactionLink = `https://elated-tan-skat.explorer.mainnet.skalenodes.com/token/0xcB48dF8e2FE472D8Be277348683bBD401Cab6201/instance/${NFT_data_safe.tokenId}`;
    } else {
        transactionLink = `https://songbird-explorer.flare.network/token/0x41a7435ef2cbd77df7c6966af4e62a9b12416398/instance/${NFT_data_safe.tokenId}/token-transfers`;
    }

    const ownerAddr = NFT_data_safe.ownerAddress || '';
    const ownerShort = ownerAddr.length > 12
        ? `${ownerAddr.slice(0, 6)}…${ownerAddr.slice(-4)}`
        : ownerAddr;
    // User.html в проекте нет — ведём в основной explorer истории
    const ownerInfo = ownerAddr
        ? `<p><b>Owner:</b> <a href="../index.html?address=${encodeURIComponent(ownerAddr)}" target="_blank" rel="noopener noreferrer" title="${ownerAddr}">${ownerShort}</a></p>`
        : '<p><b>Owner:</b> Данные получить невозможно</p>';

    const tokenHtml = `
        <p>Token ID: <b>${NFT_data_safe.tokenId}</b></p>
        <p>Collection: <b>${NFT_data_safe.collectionId} "${NFT_data_safe.collectionName || ''}"</b></p>
        <p>NFT typeId: ${NFT_data_safe.typeId}</p>
        <p>Token slots: ${NFT_data_safe.slots}</p>
        <p>NFT rarity: <b>${NFT_data_safe.rarity} "${rarityArray[Number(NFT_data_safe.rarity) - 1] || 'Unknown'}"</b></p>
        <p>NFT soulbound: ${NFT_data_safe.soulbound}</p>
        <p>NFT disposable: ${NFT_data_safe.disposable}</p>
        ${ownerInfo}
        <p><a href="${transactionLink}" target="_blank" rel="noopener noreferrer">View Transactions</a></p>
    `;

    const resultEl = document.getElementById('result');
    if (resultEl) resultEl.innerHTML = tokenHtml;

    const nftImage = document.getElementById('nft-image');
    const nftName = document.getElementById('nft-name');
    const nftCollection = document.getElementById('nft-collection');
    const nftRarity = document.getElementById('nft-rarity');

    if (nftName) nftName.textContent = NFT_data_safe.name || 'NFT';
    if (nftCollection) nftCollection.textContent = NFT_data_safe.collectionName || 'Unknown Collection';

    const rarityIndex = Number(NFT_data_safe.rarity) - 1;
    const rarityText = rarityArray[rarityIndex] || 'Unknown';
    const rarityColors = ['#ffffff', '#00ff66', '#00a2ff', '#cc00ff', '#ff7700'];
    if (nftRarity) {
        nftRarity.textContent = rarityText;
        nftRarity.style.color = rarityColors[rarityIndex] || '#ffffff';
    }

    let imageUrl = NFT_data_safe.tokenURI || '';
    if (imageUrl && imageUrl.includes('gateway.dedrive.io/v1/access/')) {
        const urlParts = imageUrl.split('/');
        const hash = urlParts[urlParts.length - 1];
        imageUrl = `https://storage.hellopixel.network/nft/dedrive/${hash}.png`;
    }

    if (nftImage) {
        nftImage.onerror = () => {
            nftImage.removeAttribute('src');
            nftImage.alt = 'Image not available';
        };
        if (imageUrl) {
            nftImage.src = imageUrl;
            nftImage.style.display = 'block';
        }
        const rarity = Number(NFT_data_safe.rarity);
        nftImage.className = `token-image rarity-${rarity}`;
    }

    const modifiersList = document.getElementById('modifiers-list');
    if (modifiersList) modifiersList.innerHTML = formattedVariants;
}

function validateAndFetch() {
    const tokenIdInput = document.getElementById('tokenId');
    const tokenId = (tokenIdInput?.value || '').trim();
    const resultEl = document.getElementById('result');

    if (!tokenId || !/^\d+$/.test(tokenId)) {
        if (resultEl) {
            resultEl.innerHTML = '<p style="color: #f87171;">Введите корректный Token ID (только цифры).</p>';
        }
        return;
    }

    fetchAndDisplayNFTInfo();
}

async function fetchAndDisplayNFTInfo() {
    const tokenIdInput = document.getElementById('tokenId');
    const tokenId = (tokenIdInput?.value || '').trim();
    const resultEl = document.getElementById('result');

    try {
        if (resultEl) resultEl.innerHTML = '<p>Загрузка…</p>';
        const NFT_data = await fetchNFTData(tokenId);
        displayNFTInfo(NFT_data);
    } catch (error) {
        const msg = error?.message || String(error);
        if (resultEl) {
            resultEl.innerHTML = `<p style="color: #f87171;">Ошибка: ${msg}</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fetch-button')?.addEventListener('click', validateAndFetch);

    document.querySelectorAll('input[name="network"]').forEach(radio => {
        radio.addEventListener('change', onNetworkChange);
    });

    document.getElementById('back-btn')?.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '../index.html';
        }
    });

    // tokenId / network из URL — сразу загружаем (без setTimeout)
    const urlParams = new URLSearchParams(window.location.search);
    const nftId = urlParams.get('tokenId');
    const network = urlParams.get('network');

    if (network) {
        document.querySelectorAll('input[name="network"]').forEach(radio => {
            radio.checked = radio.value === network;
        });
        onNetworkChange();
    }

    if (nftId && /^\d+$/.test(nftId)) {
        const input = document.getElementById('tokenId');
        if (input) input.value = nftId;
        validateAndFetch();
    }
});
