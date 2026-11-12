package com.einthusan.tv.subtitles

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.File
import java.net.URL

object SubtitleConfig {
    // Inscris-toi gratuitement sur https://www.opensubtitles.com/en/consumers
    // pour obtenir ta clé API, puis remplace la valeur ci-dessous.
    const val API_KEY = "METTRE_TA_CLE_API_OPENSUBTITLES_ICI"
    const val BASE_URL = "https://api.opensubtitles.com/api/v1/"
}

enum class SubtitleLang(val code: String, val label: String) {
    FRENCH("fr", "Français"),
    ARABIC("ar", "العربية")
}

/**
 * Gère la recherche et le téléchargement de sous-titres FR/AR depuis OpenSubtitles,
 * puis la conversion en liste de SubtitleCue utilisable par le lecteur.
 */
class SubtitleManager(private val context: Context) {

    private val api: OpenSubtitlesApi by lazy {
        Retrofit.Builder()
            .baseUrl(SubtitleConfig.BASE_URL)
            .client(OkHttpClient())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(OpenSubtitlesApi::class.java)
    }

    /**
     * Cherche puis télécharge le premier sous-titre disponible pour [movieTitle]
     * dans la langue [lang]. Renvoie le fichier .srt local, ou null si rien trouvé.
     */
    suspend fun fetchSubtitle(movieTitle: String, lang: SubtitleLang): File? =
        withContext(Dispatchers.IO) {
            try {
                val search = api.searchSubtitles(SubtitleConfig.API_KEY, movieTitle, lang.code)
                val firstFile = search.body()?.data
                    ?.firstOrNull { it.attributes.language == lang.code }
                    ?.attributes?.files?.firstOrNull() ?: return@withContext null

                val download = api.requestDownload(
                    SubtitleConfig.API_KEY,
                    DownloadRequest(firstFile.file_id)
                ).body() ?: return@withContext null

                val outFile = File(context.cacheDir, "sub_${lang.code}_${movieTitle.hashCode()}.srt")
                URL(download.link).openStream().use { input ->
                    outFile.outputStream().use { output -> input.copyTo(output) }
                }
                outFile
            } catch (e: Exception) {
                null
            }
        }

    /** Parse un fichier .srt en une liste de répliques chronométrées. */
    fun parseSrt(file: File): List<SubtitleCue> {
        val text = file.readText(Charsets.UTF_8)
        val blocks = text.split(Regex("\\r?\\n\\r?\\n"))
        val cues = mutableListOf<SubtitleCue>()
        val timeRegex = Regex(
            "(\\d{2}):(\\d{2}):(\\d{2}),(\\d{3})\\s*-->\\s*(\\d{2}):(\\d{2}):(\\d{2}),(\\d{3})"
        )
        for (block in blocks) {
            val match = timeRegex.find(block) ?: continue
            val (h1, m1, s1, ms1, h2, m2, s2, ms2) = match.destructured
            val start = toMillis(h1, m1, s1, ms1)
            val end = toMillis(h2, m2, s2, ms2)
            val lines = block.lines().drop(
                block.lines().indexOfFirst { timeRegex.containsMatchIn(it) } + 1
            ).joinToString("\n").trim()
            if (lines.isNotEmpty()) cues.add(SubtitleCue(start, end, lines))
        }
        return cues
    }

    private fun toMillis(h: String, m: String, s: String, ms: String): Long =
        h.toLong() * 3_600_000 + m.toLong() * 60_000 + s.toLong() * 1000 + ms.toLong()
}

data class SubtitleCue(val startMs: Long, val endMs: Long, val text: String)
