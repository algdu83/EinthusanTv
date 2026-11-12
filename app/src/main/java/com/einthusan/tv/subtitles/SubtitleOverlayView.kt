package com.einthusan.tv.subtitles

import android.content.Context
import android.graphics.Color
import android.util.AttributeSet
import android.view.Gravity
import android.widget.TextView

/**
 * Overlay de sous-titres style Netflix : fond noir semi-opaque derrière un texte blanc.
 * Le décalage (offsetMs) permet d'avancer ou reculer la synchronisation sans retélécharger
 * le fichier : il est simplement ajouté/retranché aux horodatages à chaque mise à jour.
 */
class SubtitleOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : TextView(context, attrs) {

    private var cues: List<SubtitleCue> = emptyList()
    var offsetMs: Long = 0L
        private set

    init {
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.argb(180, 0, 0, 0)) // fond noir semi-transparent derrière le texte
        textSize = 22f
        gravity = Gravity.CENTER
        setPadding(24, 8, 24, 8)
        visibility = INVISIBLE
    }

    fun setCues(newCues: List<SubtitleCue>) {
        cues = newCues
    }

    /** Décale tous les sous-titres de [deltaMs] (positif = avance, négatif = recule). */
    fun shiftOffset(deltaMs: Long) {
        offsetMs += deltaMs
    }

    fun resetOffset() {
        offsetMs = 0L
    }

    /** À appeler à chaque tick du lecteur (ex. toutes les 200 ms) avec la position de lecture. */
    fun updateForPosition(positionMs: Long) {
        val adjusted = positionMs - offsetMs
        val active = cues.firstOrNull { adjusted in it.startMs..it.endMs }
        if (active != null) {
            text = active.text
            visibility = VISIBLE
        } else {
            visibility = INVISIBLE
        }
    }
}
