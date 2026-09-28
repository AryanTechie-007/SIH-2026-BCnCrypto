// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocumentLedger
 * @notice QuantumGuard SIH 2026 - Immutable Chain-of-Custody & Forensic Audit Ledger
 * @dev Records post-quantum decryption events and DCT watermark bindings for court-admissible provenance.
 */
contract DocumentLedger {

    address public admin;

    struct DecryptionRecord {
        bytes32 documentHash;
        string watermarkId;
        string recipientId;
        string deviceId;
        uint256 timestamp;
        string classification;
        bytes dsaSignature;
        bool exists;
    }

    // Mapping from Watermark ID => Decryption Record
    mapping(string => DecryptionRecord) private recordsByWatermark;
    
    // Mapping from Document Hash => Array of Decryption Records
    mapping(bytes32 => DecryptionRecord[]) private recordsByDocHash;

    string[] private allWatermarkIds;

    event DocumentAccessRecorded(
        string indexed watermarkId,
        bytes32 indexed documentHash,
        string recipientId,
        string deviceId,
        string classification,
        uint256 timestamp
    );

    event SecurityAlert(
        string indexed watermarkId,
        string reason,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "QuantumGuard: Unauthorized caller");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @notice Records an authorized decryption event on the immutable ledger.
     * @param documentHash NIST SHA3-256 hash of the confidential document
     * @param watermarkId Unique 10-byte hex ID embedded into the document's 2D DCT frame
     * @param recipientId Identifier/Navy ID of the authorized recipient
     * @param deviceId Hardware identifier of the consuming endpoint
     * @param classification Defense sensitivity level (TOP_SECRET, CONFIDENTIAL, etc.)
     * @param dsaSignature Post-quantum ML-DSA-65 signature verifying the decryption event
     */
    function recordDecryption(
        bytes32 documentHash,
        string memory watermarkId,
        string memory recipientId,
        string memory deviceId,
        string memory classification,
        bytes memory dsaSignature
    ) external onlyAdmin {
        require(bytes(watermarkId).length > 0, "QuantumGuard: Invalid watermark ID");
        require(!recordsByWatermark[watermarkId].exists, "QuantumGuard: Watermark already recorded");

        DecryptionRecord memory record = DecryptionRecord({
            documentHash: documentHash,
            watermarkId: watermarkId,
            recipientId: recipientId,
            deviceId: deviceId,
            timestamp: block.timestamp,
            classification: classification,
            dsaSignature: dsaSignature,
            exists: true
        });

        recordsByWatermark[watermarkId] = record;
        recordsByDocHash[documentHash].push(record);
        allWatermarkIds.push(watermarkId);

        emit DocumentAccessRecorded(
            watermarkId,
            documentHash,
            recipientId,
            deviceId,
            classification,
            block.timestamp
        );
    }

    /**
     * @notice Look up a decryption record by its extracted watermark ID for forensic attribution.
     */
    function lookupByWatermark(string memory watermarkId) 
        external 
        view 
        returns (
            bytes32 documentHash,
            string memory recipientId,
            string memory deviceId,
            uint256 timestamp,
            string memory classification,
            bytes memory dsaSignature
        ) 
    {
        DecryptionRecord memory r = recordsByWatermark[watermarkId];
        require(r.exists, "QuantumGuard: Watermark not found on ledger");
        return (
            r.documentHash,
            r.recipientId,
            r.deviceId,
            r.timestamp,
            r.classification,
            r.dsaSignature
        );
    }

    /**
     * @notice Returns total number of recorded decryption transactions.
     */
    function getTotalRecordCount() external view returns (uint256) {
        return allWatermarkIds.length;
    }
}
