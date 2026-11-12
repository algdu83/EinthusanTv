package com.einthusan.tv.subtitles

import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query
import retrofit2.http.Headers
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Client pour l'API REST officielle OpenSubtitles (https://api.opensubtitles.com).
 * Une clé API gratuite est nécessaire : https://www.opensubtitles.com/en/consumers
 * -> à renseigner dans SubtitleConfig.API_KEY
 */
interface OpenSubtitlesApi {

    @Headers("Content-Type: application/json")
    @GET("subtitles")
    suspend fun searchSubtitles(
        @Header("Api-Key") apiKey: String,
        @Query("query") title: String,
        @Query("languages") languages: String // ex: "fr,ar"
    ): Response<SubtitleSearchResponse>

    @Headers("Content-Type: application/json")
    @POST("download")
    suspend fun requestDownload(
        @Header("Api-Key") apiKey: String,
        @Body body: DownloadRequest
    ): Response<DownloadResponse>
}

data class SubtitleSearchResponse(val data: List<SubtitleResult>)

data class SubtitleResult(
    val id: String,
    val attributes: SubtitleAttributes
)

data class SubtitleAttributes(
    val language: String,
    val release: String?,
    val files: List<SubtitleFile>
)

data class SubtitleFile(
    val file_id: Long,
    val file_name: String?
)

data class DownloadRequest(val file_id: Long)
data class DownloadResponse(val link: String, val file_name: String)
