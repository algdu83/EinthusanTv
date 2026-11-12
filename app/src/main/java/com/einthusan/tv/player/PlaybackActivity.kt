package com.einthusan.tv.player

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.einthusan.tv.R
import com.einthusan.tv.subtitles.SubtitleLang
import com.einthusan.tv.subtitles.SubtitleManager
import com.einthusan.tv.subtitles.SubtitleOverlayView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Lecteur vidéo plein écran façon Netflix : ExoPlayer + overlay de sous-titres maison
 * (fond noir / texte blanc) avec téléchargement OpenSubtitles et réglage du décalage
 * temporel (avance/recul) commandé à la télécommande.
 */
class PlaybackActivity : AppCompatActivity() {

    private lateinit var player: ExoPlayer
    private lateinit var playerView: PlayerView
    private lateinit var subtitleOverlay: SubtitleOverlayView
    private lateinit var subtitleManager: SubtitleManager
    private lateinit var txtOffset: TextView
    private lateinit var syncControls: View

    private var currentLang = SubtitleLang.FRENCH
    private val tickHandler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_playback)

        val movieTitle = intent.getStringExtra(EXTRA_TITLE) ?: "Film"
        val streamUrl = intent.getStringExtra(EXTRA_STREAM_URL) ?: return

        playerView = findViewById(R.id.player_view)
        subtitleOverlay = findViewById(R.id.subtitle_overlay)
        syncControls = findViewById(R.id.sync_controls)
        txtOffset = findViewById(R.id.txt_offset)
        subtitleManager = SubtitleManager(this)

        player = ExoPlayer.Builder(this).build()
        playerView.player = player
        player.setMediaItem(MediaItem.fromUri(streamUrl))
        player.prepare()
        player.playWhenReady = true

        findViewById<Button>(R.id.btn_sub_back).setOnClickListener {
            subtitleOverlay.shiftOffset(-500)
            refreshOffsetLabel()
        }
        findViewById<Button>(R.id.btn_sub_forward).setOnClickListener {
            subtitleOverlay.shiftOffset(500)
            refreshOffsetLabel()
        }
        findViewById<Button>(R.id.btn_sub_lang).setOnClickListener {
            currentLang = if (currentLang == SubtitleLang.FRENCH) SubtitleLang.ARABIC else SubtitleLang.FRENCH
            loadSubtitles(movieTitle)
        }

        loadSubtitles(movieTitle)
        startSubtitleTicker()
    }

    /** Télécharge et charge les sous-titres OpenSubtitles pour la langue courante. */
    private fun loadSubtitles(movieTitle: String) {
        subtitleOverlay.setCues(emptyList())
        scope.launch {
            val file = subtitleManager.fetchSubtitle(movieTitle, currentLang)
            if (file != null) {
                val cues = subtitleManager.parseSrt(file)
                subtitleOverlay.setCues(cues)
            }
        }
    }

    private fun startSubtitleTicker() {
        tickHandler.post(object : Runnable {
            override fun run() {
                subtitleOverlay.updateForPosition(player.currentPosition)
                tickHandler.postDelayed(this, 200)
            }
        })
    }

    private fun refreshOffsetLabel() {
        val sec = subtitleOverlay.offsetMs / 1000.0
        txtOffset.text = "%+.1f s".format(sec)
    }

    /** Touche verte/jaune ou menu de la télécommande => afficher/masquer les réglages de sync. */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_CAPTIONS || keyCode == KeyEvent.KEYCODE_MENU) {
            syncControls.visibility = if (syncControls.visibility == View.VISIBLE) View.GONE else View.VISIBLE
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        super.onDestroy()
        player.release()
        tickHandler.removeCallbacksAndMessages(null)
    }

    companion object {
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_STREAM_URL = "extra_stream_url"
    }
}
