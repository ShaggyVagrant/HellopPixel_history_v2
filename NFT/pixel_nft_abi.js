const pixelNFTABI = [
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "getTokenType",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "uint256",
                        "name": "typeId",
                        "type": "uint256"
                    },
                    {
                        "components": [
                            {
                                "internalType": "uint8",
                                "name": "parameterId",
                                "type": "uint8"
                            },
                            {
                                "internalType": "uint24",
                                "name": "mul",
                                "type": "uint24"
                            },
                            {
                                "internalType": "uint256",
                                "name": "add",
                                "type": "uint256"
                            }
                        ],
                        "internalType": "struct Modifier[][]",
                        "name": "variants",
                        "type": "tuple[][]"
                    },
                    {
                        "internalType": "string",
                        "name": "tokenURI",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "name",
                        "type": "string"
                    },
                    {
                        "internalType": "uint8[]",
                        "name": "slots",
                        "type": "uint8[]"
                    },
                    {
                        "internalType": "uint256",
                        "name": "collectionId",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint8",
                        "name": "rarity",
                        "type": "uint8"
                    },
                    {
                        "internalType": "bool",
                        "name": "soulbound",
                        "type": "bool"
                    },
                    {
                        "internalType": "bool",
                        "name": "disposable",
                        "type": "bool"
                    }
                ],
                "internalType": "struct ItemType",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "getCollections",
        "outputs": [
            {
                "internalType": "string[]",
                "name": "",
                "type": "string[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "ownerOf",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Экспорт для разных сред
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pixelNFTABI };
} else {
    window.pixelNFTABI = pixelNFTABI;
}