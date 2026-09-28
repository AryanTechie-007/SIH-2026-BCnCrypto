package com.ciphertrace.android.security

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
        hybridKey: ByteArray, // Derived from the PQC + Classical handshake
        iv: ByteArray,
        tag: ByteArray
    ): ByteArray {
        val secretKey = SecretKeySpec(hybridKey, "AES")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(128, iv)
        
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        
        val payloadWithTag = if (tag.isNotEmpty() && !encryptedData.takeLast(tag.size).toByteArray().contentEquals(tag)) {
            encryptedData + tag
        } else {
            encryptedData
        }
        
        return cipher.doFinal(payloadWithTag)
    }

    /**
     * Logic for the Forensic Watermark extraction and device binding
     */
    fun extractDeviceBinding(metadata: String): Boolean {
        val deviceId = android.os.Build.ID
        return metadata.contains(deviceId)
    }
}
