package com.asaddon.einthusantv.subtitles

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * API REST v1 d'OpenSubtitles.com.
 * Doc: https://opensubtitles.stoplight.io/docs/opensubtitles-api
 */
interface OpenSubtitlesService {

    @GET("subtitles")
    suspend fun search(
        @Header("Api-Key") apiKey: String,
        @Query("query") query: String,
        @Query("languages") languageCode: String
    ): OpenSubtitlesSearchResponse

    @POST("download")
    suspend fun requestDownload(
        @Header("Api-Key") apiKey: String,
        @Body body: DownloadRequest
    ): DownloadResponse
}
