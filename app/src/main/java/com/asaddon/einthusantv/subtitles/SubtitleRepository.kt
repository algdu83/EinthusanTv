package com.asaddon.einthusantv.subtitles

import android.content.Context
import com.asaddon.einthusantv.BuildConfig
import com.asaddon.einthusantv.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File

/**
 * Recherche, telecharge et met en cache les sous-titres OpenSubtitles pour un film donne,
 * et applique un decalage temporel (avance/recul) a la demande.
 */
class SubtitleRepository(private val context: Context) {

    private var originalSrtContent: String? = null
    private var currentOffsetMs: Long = 0L

    /**
     * Cherche un sous-titre sur OpenSubtitles pour [movieTitle] dans la langue [language],
     * le telecharge et le garde en memoire. Retourne le fichier .srt pret a etre lu par le
     * lecteur, ou null si aucun sous-titre n'a ete trouve.
     */
    suspend fun loadSubtitle(movieTitle: String, language: SubtitleLanguage): File? =
        withContext(Dispatchers.IO) {
            if (language == SubtitleLanguage.OFF) return@withContext null
            if (BuildConfig.OPENSUBTITLES_API_KEY.isBlank()) return@withContext null

            val searchResponse = ApiClient.openSubtitlesApi.search(
                apiKey = BuildConfig.OPENSUBTITLES_API_KEY,
                query = movieTitle,
                languageCode = language.code
            )

            val firstResult = searchResponse.data.firstOrNull() ?: return@withContext null
            val firstFile = firstResult.attributes.files.firstOrNull() ?: return@withContext null

            val downloadResponse = ApiClient.openSubtitlesApi.requestDownload(
                apiKey = BuildConfig.OPENSUBTITLES_API_KEY,
                body = DownloadRequest(fileId = firstFile.fileId)
            )
            val downloadLink = downloadResponse.link ?: return@withContext null

            val srtContent = downloadRawText(downloadLink) ?: return@withContext null
            originalSrtContent = srtContent
            currentOffsetMs = 0L

            writeAdjustedSubtitleFile(srtContent, 0L)
        }

    /**
     * Ajoute [deltaMs] au decalage courant (peut etre negatif) et reecrit le fichier .srt
     * ajuste dans le cache. Retourne le nouveau fichier, ou null si aucun sous-titre n'est charge.
     */
    suspend fun adjustOffset(deltaMs: Long): File? = withContext(Dispatchers.IO) {
        val content = originalSrtContent ?: return@withContext null
        currentOffsetMs += deltaMs
        writeAdjustedSubtitleFile(content, currentOffsetMs)
    }

    fun clear() {
        originalSrtContent = null
        currentOffsetMs = 0L
    }

    private fun writeAdjustedSubtitleFile(originalContent: String, offsetMs: Long): File {
        val adjusted = SrtUtils.applyOffset(originalContent, offsetMs)
        val file = File(context.cacheDir, "subtitle_current.srt")
        file.writeText(adjusted)
        return file
    }

    private fun downloadRawText(url: String): String? {
        val request = Request.Builder().url(url).build()
        return try {
            ApiClient.rawHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                response.body?.string()
            }
        } catch (e: Exception) {
            null
        }
    }
}
