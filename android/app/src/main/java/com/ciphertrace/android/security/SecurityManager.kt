package com.ciphertrace.android.security

import android.app.Activity
import android.os.Build
import android.view.WindowManager
import java.io.File

/**
 * Mobile device shielding and environment integrity assurance.
 */
object SecurityManager {

    /**
     * Enforces FLAG_SECURE on the current window to prevent screenshots, screen sharing,
     * and screen recording of sensitive classified documents.
     */
    fun setScreenProtection(activity: Activity, enabled: Boolean) {
        activity.runOnUiThread {
            if (enabled) {
                activity.window.setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                )
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }

    /**
     * Checks if the device has indications of root access.
     */
    fun isDeviceRooted(): Boolean {
        val paths = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su"
        )
        for (path in paths) {
            if (File(path).exists()) return true
        }
        val buildTags = Build.TAGS
        return buildTags != null && buildTags.contains("test-keys")
    }

    /**
     * Returns a human-readable device model summary.
     */
    fun getDeviceModelName(): String {
        val manufacturer = Build.MANUFACTURER.replaceFirstChar { it.uppercase() }
        val model = Build.MODEL
        return if (model.startsWith(manufacturer, ignoreCase = true)) {
            model
        } else {
            "$manufacturer $model"
        }
    }
}
