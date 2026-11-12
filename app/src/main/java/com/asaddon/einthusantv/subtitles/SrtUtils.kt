package com.asaddon.einthusantv.subtitles

import java.util.Locale
import java.util.regex.Pattern

/**
 * Petit utilitaire pour parser un fichier .srt, decaler toutes ses lignes de temps
 * d'un offset (en millisecondes, positif ou negatif) puis le re-serialiser.
 * Permet l'option "avancer / reculer" les sous-titres demandee par l'utilisateur,
 * sans dependre d'une API de decalage native du lecteur.
 */
object SrtUtils {

    private val TIME_LINE_PATTERN = Pattern.compile(
        "(\\d{2}):(\\d{2}):(\\d{2})[,.](\\d{3})\\s*-->\\s*(\\d{2}):(\\d{2}):(\\d{2})[,.](\\d{3})"
    )

    private fun timeToMillis(h: String, m: String, s: String, ms: String): Long {
        return (h.toLong() * 3600_000L) + (m.toLong() * 60_000L) + (s.toLong() * 1000L) + ms.toLong()
    }

    private fun millisToTimeString(totalMillisInput: Long): String {
        val totalMillis = if (totalMillisInput < 0) 0 else totalMillisInput
        val h = totalMillis / 3600_000
        val m = (totalMillis % 3600_000) / 60_000
        val s = (totalMillis % 60_000) / 1000
        val ms = totalMillis % 1000
        return String.format(Locale.US, "%02d:%02d:%02d,%03d", h, m, s, ms)
    }

    /**
     * Applique un decalage (en millisecondes) a toutes les lignes de temps d'un contenu .srt.
     * Un offset positif retarde les sous-titres (ils apparaissent plus tard),
     * un offset negatif les avance.
     */
    fun applyOffset(srtContent: String, offsetMs: Long): String {
        if (offsetMs == 0L) return srtContent

        val lines = srtContent.split("\n")
        val output = StringBuilder()

        for (line in lines) {
            val matcher = TIME_LINE_PATTERN.matcher(line.trim())
            if (matcher.matches()) {
                val startMs = timeToMillis(matcher.group(1)!!, matcher.group(2)!!, matcher.group(3)!!, matcher.group(4)!!) + offsetMs
                val endMs = timeToMillis(matcher.group(5)!!, matcher.group(6)!!, matcher.group(7)!!, matcher.group(8)!!) + offsetMs
                output.append(millisToTimeString(startMs))
                output.append(" --> ")
                output.append(millisToTimeString(endMs))
                output.append("\n")
            } else {
                output.append(line)
                output.append("\n")
            }
        }
        return output.toString()
    }
}
