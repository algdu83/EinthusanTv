package com.einthusan.tv.ui

import android.os.Bundle
import androidx.leanback.app.BrowseSupportFragment
import androidx.leanback.widget.ArrayObjectAdapter
import androidx.leanback.widget.HeaderItem
import androidx.leanback.widget.ListRow
import androidx.leanback.widget.ListRowPresenter
import androidx.leanback.widget.OnItemViewClickedListener
import androidx.leanback.widget.Presenter
import androidx.leanback.widget.Row
import androidx.leanback.widget.RowPresenter
import com.einthusan.tv.data.MovieRepository
import com.einthusan.tv.model.Movie
import com.einthusan.tv.player.PlaybackActivity
import android.content.Intent

/**
 * Écran d'accueil façon Netflix : rangées horizontales de contenus par catégorie,
 * navigables au D-pad.
 */
class MainFragment : BrowseSupportFragment() {

    override fun onActivityCreated(savedInstanceState: Bundle?) {
        super.onActivityCreated(savedInstanceState)
        title = "Einthusan TV"
        headersState = HEADERS_ENABLED
        isHeadersTransitionOnBackEnabled = true
        buildRows()
        setupClickListener()
    }

    private fun buildRows() {
        val rowsAdapter = ArrayObjectAdapter(ListRowPresenter())
        val cardPresenter = CardPresenter()

        val categories = MovieRepository.getCategories()
        categories.forEachIndexed { index, category ->
            val listRowAdapter = ArrayObjectAdapter(cardPresenter)
            MovieRepository.getMoviesForCategory(category).forEach { listRowAdapter.add(it) }
            val header = HeaderItem(index.toLong(), category)
            rowsAdapter.add(ListRow(header, listRowAdapter))
        }
        adapter = rowsAdapter
    }

    private fun setupClickListener() {
        onItemViewClickedListener = OnItemViewClickedListener {
                _: Presenter.ViewHolder?, item: Any?,
                _: RowPresenter.ViewHolder?, _: Row? ->
            if (item is Movie) {
                val intent = Intent(requireContext(), PlaybackActivity::class.java).apply {
                    putExtra(PlaybackActivity.EXTRA_TITLE, item.title)
                    putExtra(PlaybackActivity.EXTRA_STREAM_URL, item.streamUrl)
                }
                startActivity(intent)
            }
        }
    }
}
