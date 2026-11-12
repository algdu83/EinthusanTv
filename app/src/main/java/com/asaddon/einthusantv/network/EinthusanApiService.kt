package com.asaddon.einthusantv.network

import com.asaddon.einthusantv.model.CatalogResponse
import com.asaddon.einthusantv.model.StreamResponse
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * API de l'addon Einthusan, basee sur le protocole standard des addons Stremio.
 */
interface EinthusanApiService {

    @GET("catalog/{type}/{id}.json")
    suspend fun getCatalog(
        @Path("type") type: String,
        @Path("id") id: String
    ): CatalogResponse

    @GET("stream/{type}/{id}.json")
    suspend fun getStreams(
        @Path("type") type: String,
        @Path("id") id: String
    ): StreamResponse
}
