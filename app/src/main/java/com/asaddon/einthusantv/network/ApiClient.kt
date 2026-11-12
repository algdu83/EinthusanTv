package com.asaddon.einthusantv.network

import com.asaddon.einthusantv.subtitles.OpenSubtitlesService
import com.asaddon.einthusantv.util.Constants
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
    }

    val rawHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .addInterceptor(loggingInterceptor)
            .build()
    }

    private val gson = GsonBuilder().setLenient().create()

    val einthusanApi: EinthusanApiService by lazy {
        Retrofit.Builder()
            .baseUrl(Constants.ADDON_BASE_URL)
            .client(rawHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(EinthusanApiService::class.java)
    }

    val openSubtitlesApi: OpenSubtitlesService by lazy {
        Retrofit.Builder()
            .baseUrl(Constants.OPENSUBTITLES_BASE_URL)
            .client(rawHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(OpenSubtitlesService::class.java)
    }
}
