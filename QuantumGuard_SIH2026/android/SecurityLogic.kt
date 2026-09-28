package com.sih.quantumguard

import android.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class MobilePQC {
    fun decryptFieldData(encryptedHex: String, keyHex: String, ivHex: String): String {
        val key = SecretKeySpec(hexToBytes(keyHex), "AES")
        val iv = hexToBytes(ivHex)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        
        // 128 bit tag length, use the IV from backend
        val spec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.DECRYPT_MODE, key, spec)
        
        val decryptedBytes = cipher.doFinal(hexToBytes(encryptedHex))
        return String(decryptedBytes)
    }

    private fun hexToBytes(hex: String): ByteArray = 
        hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
