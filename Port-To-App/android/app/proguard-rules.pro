# Proguard rules for CIPHERTRACE Android
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Preserve Retrofit and OkHttp models
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.ciphertrace.android.data.model.** { *; }

# Preserve Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory { *; }
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler { *; }
