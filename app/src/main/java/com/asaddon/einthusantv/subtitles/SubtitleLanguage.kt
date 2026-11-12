package com.asaddon.einthusantv.subtitles

enum class SubtitleLanguage(val code: String, val displayNameRes: Int) {
    OFF("off", com.asaddon.einthusantv.R.string.subtitles_off),
    FRENCH("fr", com.asaddon.einthusantv.R.string.subtitles_french),
    ARABIC("ar", com.asaddon.einthusantv.R.string.subtitles_arabic);

    fun next(): SubtitleLanguage {
        val values = entries
        return values[(this.ordinal + 1) % values.size]
    }
}
