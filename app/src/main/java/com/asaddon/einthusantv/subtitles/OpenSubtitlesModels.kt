package com.asaddon.einthusantv.subtitles

import com.google.gson.annotations.SerializedName

data class OpenSubtitlesSearchResponse(
    @SerializedName("data") val data: List<OpenSubtitlesResult> = emptyList()
)

data class OpenSubtitlesResult(
    @SerializedName("id") val id: String,
    @SerializedName("attributes") val attributes: OpenSubtitlesAttributes
)

data class OpenSubtitlesAttributes(
    @SerializedName("language") val language: String?,
    @SerializedName("release") val release: String?,
    @SerializedName("files") val files: List<OpenSubtitlesFile> = emptyList()
)

data class OpenSubtitlesFile(
    @SerializedName("file_id") val fileId: Long,
    @SerializedName("file_name") val fileName: String?
)

data class DownloadRequest(
    @SerializedName("file_id") val fileId: Long
)

data class DownloadResponse(
    @SerializedName("link") val link: String?,
    @SerializedName("file_name") val fileName: String?
)
