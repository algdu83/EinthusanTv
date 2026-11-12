package com.asaddon.einthusantv.model

import com.google.gson.annotations.SerializedName

/**
 * Represente un element "meta" du protocole Stremio (un film).
 */
data class Movie(
    @SerializedName("id") val id: String,
    @SerializedName("type") val type: String?,
    @SerializedName("name") val name: String,
    @SerializedName("poster") val poster: String?,
    @SerializedName("background") val background: String?,
    @SerializedName("description") val description: String?,
    @SerializedName("releaseInfo") val releaseInfo: String?,
    @SerializedName("imdb_id") val imdbId: String?
)

data class CatalogResponse(
    @SerializedName("metas") val metas: List<Movie> = emptyList()
)

data class StreamItem(
    @SerializedName("url") val url: String?,
    @SerializedName("title") val title: String?,
    @SerializedName("name") val name: String?
)

data class StreamResponse(
    @SerializedName("streams") val streams: List<StreamItem> = emptyList()
)
