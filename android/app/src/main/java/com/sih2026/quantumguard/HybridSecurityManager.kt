package com.sih2026.quantumguard

import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class HybridSecurityManager {

    /**
     * Decrypts the document using the Hybrid Key derived from 
     * ML-KEM (Quantum) and X25519 (Classical).
     */
    fun decryptDocument(
        encryptedData: ByteArray,
        hybridKey: ByteArray, // This is derived from the PQC + Classical handshake
        iv: ByteArray,
        tag: ByteArray
    ): ByteArray {
        val secretKey = SecretKeySpec(hybridKey, "AES")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, iv)
        
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        
        // Combine payload and tag for standard AES-GCM processing if tag is provided separately
        val payloadWithTag = if (tag.isNotEmpty() && !encryptedData.takeLast(tag.size).toByteArray().contentEquals(tag)) {
            encryptedData + tag
        } else {
            encryptedData
        }
        
        return cipher.doFinal(payloadWithTag)
    }

    /**
     * Logic for the Forensic Watermark extraction
     */
    fun extractDeviceBinding(metadata: String): Boolean {
        // Verifies if the device's unique PQC ID matches the document's lock
        val deviceId = android.os.Build.ID
        return metadata.contains(deviceId)
    }
}
