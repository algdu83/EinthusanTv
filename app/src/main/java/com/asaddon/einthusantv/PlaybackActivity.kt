package com.asaddon.einthusantv

import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.CaptionStyleCompat
import com.asaddon.einthusantv.databinding.ActivityPlaybackBinding
import com.asaddon.einthusantv.network.ApiClient
import com.asaddon.einthusantv.subtitles.SubtitleLanguage
import com.asaddon.einthusantv.subtitles.SubtitleRepository
import com.asaddon.einthusantv.util.Constants
import kotlinx.coroutines.launch
import java.io.File

class PlaybackActivity : ComponentActivity() {

    companion object {
        const val EXTRA_MOVIE_ID = "extra_movie_id"
        const val EXTRA_MOVIE_TITLE = "extra_movie_title"
    }

    private lateinit var binding: ActivityPlaybackBinding
    private lateinit var subtitleRepository: SubtitleRepository
    private var player: ExoPlayer? = null

    private var movieId: String = ""
    private var movieTitle: String = ""
    private var streamUrl: String? = null
    private var currentLanguage: SubtitleLanguage = SubtitleLanguage.OFF

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlaybackBinding.inflate(layoutInflater)
        setContentView(binding.root)

        movieId = intent.getStringExtra(EXTRA_MOVIE_ID) ?: ""
        movieTitle = intent.getStringExtra(EXTRA_MOVIE_TITLE) ?: ""
        binding.titleText.text = movieTitle

        subtitleRepository = SubtitleRepository(applicationContext)

        setupPlayer()
        setupSubtitleStyle()
        setupControls()
        setLoading(true, getString(R.string.loading_stream))

        loadStreamAndPlay()
    }

    private fun setupPlayer() {
        val exoPlayer = ExoPlayer.Builder(this).build()
        binding.playerView.player = exoPlayer
        exoPlayer.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) {
                    setLoading(false, null)
                }
            }

            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                setLoading(false, null)
                Toast.makeText(this@PlaybackActivity, R.string.stream_error, Toast.LENGTH_LONG).show()
            }
        })
        player = exoPlayer
    }

    private fun setupSubtitleStyle() {
        // Fond noir derriere un texte blanc, sans contour, comme demande.
        val style = CaptionStyleCompat(
            Color.WHITE,
            Color.parseColor("#CC000000"),
            Color.TRANSPARENT,
            CaptionStyleCompat.EDGE_TYPE_NONE,
            Color.BLACK,
            null
        )
        binding.playerView.subtitleView?.setApplyEmbeddedStyles(false)
        binding.playerView.subtitleView?.setApplyEmbeddedFontSizes(false)
        binding.playerView.subtitleView?.setStyle(style)
    }

    private fun setupControls() {
        updateSubtitleButtonLabel()

        binding.buttonSubtitleLang.setOnClickListener {
            currentLanguage = currentLanguage.next()
            updateSubtitleButtonLabel()
            applySubtitleLanguage(currentLanguage)
        }

        binding.buttonSyncForward.setOnClickListener {
            shiftSubtitles(Constants.SUBTITLE_OFFSET_STEP_MS)
        }

        binding.buttonSyncBackward.setOnClickListener {
            shiftSubtitles(-Constants.SUBTITLE_OFFSET_STEP_MS)
        }
    }

    private fun updateSubtitleButtonLabel() {
        binding.buttonSubtitleLang.setText(currentLanguage.displayNameRes)
    }

    private fun loadStreamAndPlay() {
        lifecycleScope.launch {
            try {
                val response = ApiClient.einthusanApi.getStreams(
                    type = Constants.CATALOG_TYPE,
                    id = movieId
                )
                val url = response.streams.firstOrNull()?.url
                if (url.isNullOrBlank()) {
                    setLoading(false, null)
                    Toast.makeText(this@PlaybackActivity, R.string.stream_error, Toast.LENGTH_LONG).show()
                    return@launch
                }
                streamUrl = url
                playMedia(subtitleFile = null)
            } catch (e: Exception) {
                setLoading(false, null)
                Toast.makeText(this@PlaybackActivity, R.string.stream_error, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun applySubtitleLanguage(language: SubtitleLanguage) {
        if (language == SubtitleLanguage.OFF) {
            playMedia(subtitleFile = null, keepPosition = true)
            return
        }

        setLoading(true, getString(R.string.subtitles_searching))
        lifecycleScope.launch {
            val file = subtitleRepository.loadSubtitle(movieTitle, language)
            setLoading(false, null)
            if (file == null) {
                Toast.makeText(this@PlaybackActivity, R.string.subtitles_not_found, Toast.LENGTH_LONG).show()
                return@launch
            }
            playMedia(subtitleFile = file, keepPosition = true, languageCode = language.code)
        }
    }

    private fun shiftSubtitles(deltaMs: Long) {
        if (currentLanguage == SubtitleLanguage.OFF) return
        lifecycleScope.launch {
            val file = subtitleRepository.adjustOffset(deltaMs)
            if (file != null) {
                playMedia(subtitleFile = file, keepPosition = true, languageCode = currentLanguage.code)
            }
        }
    }

    private fun playMedia(subtitleFile: File?, keepPosition: Boolean = false, languageCode: String? = null) {
        val exoPlayer = player ?: return
        val url = streamUrl ?: return

        val resumePosition = if (keepPosition) exoPlayer.currentPosition else 0L
        val wasPlaying = exoPlayer.isPlaying || keepPosition

        val mediaItemBuilder = MediaItem.Builder().setUri(Uri.parse(url))

        if (subtitleFile != null) {
            val subtitleConfig = MediaItem.SubtitleConfiguration.Builder(Uri.fromFile(subtitleFile))
                .setMimeType(MimeTypes.APPLICATION_SUBRIP)
                .setLanguage(languageCode)
                .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                .build()
            mediaItemBuilder.setSubtitleConfigurations(listOf(subtitleConfig))
        }

        exoPlayer.setMediaItem(mediaItemBuilder.build())
        exoPlayer.prepare()
        if (resumePosition > 0) {
            exoPlayer.seekTo(resumePosition)
        }
        exoPlayer.playWhenReady = wasPlaying || !keepPosition
    }

    private fun setLoading(loading: Boolean, message: String?) {
        binding.loadingOverlay.visibility = if (loading) View.VISIBLE else View.GONE
        if (message != null) {
            binding.loadingText.text = message
        }
    }

    override fun onStop() {
        super.onStop()
        player?.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        player?.release()
        player = null
        subtitleRepository.clear()
    }
}
