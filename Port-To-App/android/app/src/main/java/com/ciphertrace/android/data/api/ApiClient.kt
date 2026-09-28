package com.ciphertrace.android.data.api

import android.content.Context
import com.ciphertrace.android.security.TokenManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Singleton API client manager with dynamic baseUrl support for on-the-fly network switching.
 */
object ApiClient {

    private var currentApi: CipherTraceApi? = null
    private var lastBaseUrl: String? = null

    fun getApi(context: Context): CipherTraceApi {
        val tokenManager = TokenManager(context)
        val targetUrl = tokenManager.getServerUrl()

        if (currentApi == null || lastBaseUrl != targetUrl) {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val okHttpClient = OkHttpClient.Builder()
                .addInterceptor(AuthInterceptor(tokenManager))
                .addInterceptor(loggingInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(targetUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            currentApi = retrofit.create(CipherTraceApi::class.java)
            lastBaseUrl = targetUrl
        }

        return currentApi!!
    }

    /**
     * Resets the client to force recreation with new network coordinates.
     */
    fun reset() {
        currentApi = null
        lastBaseUrl = null
    }
}
