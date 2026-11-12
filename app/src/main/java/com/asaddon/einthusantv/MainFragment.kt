package com.asaddon.einthusantv

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.leanback.app.BrowseSupportFragment
import androidx.leanback.widget.ArrayObjectAdapter
import androidx.leanback.widget.HeaderItem
import androidx.leanback.widget.ListRow
import androidx.leanback.widget.ListRowPresenter
import androidx.core.content.ContextCompat
import androidx.leanback.widget.OnItemViewClickedListener
import androidx.lifecycle.lifecycleScope
import com.asaddon.einthusantv.model.Movie
import com.asaddon.einthusantv.network.ApiClient
import com.asaddon.einthusantv.util.Constants
import kotlinx.coroutines.launch

class MainFragment : BrowseSupportFragment() {

    private lateinit var rowsAdapter: ArrayObjectAdapter

    override fun onActivityCreated(savedInstanceState: Bundle?) {
        super.onActivityCreated(savedInstanceState)

        title = getString(R.string.browse_title)
        headersState = HEADERS_DISABLED
        isHeadersTransitionOnBackEnabled = false
        brandColor = ContextCompat.getColor(requireContext(), R.color.background)

        rowsAdapter = ArrayObjectAdapter(ListRowPresenter())
        adapter = rowsAdapter

        onItemViewClickedListener = OnItemViewClickedListener { _, item, _, _ ->
            if (item is Movie) {
                openPlayback(item)
            }
        }

        loadCatalog()
    }

    private fun loadCatalog() {
        lifecycleScope.launch {
            try {
                val response = ApiClient.einthusanApi.getCatalog(
                    type = Constants.CATALOG_TYPE,
                    id = Constants.CATALOG_ID
                )

                if (response.metas.isEmpty()) {
                    Toast.makeText(requireContext(), R.string.error_fragment_message, Toast.LENGTH_LONG).show()
                    return@launch
                }

                val cardPresenter = CardPresenter()
                val listRowAdapter = ArrayObjectAdapter(cardPresenter)
                response.metas.forEach { listRowAdapter.add(it) }

                val header = HeaderItem(0, getString(R.string.browse_title))
                rowsAdapter.add(ListRow(header, listRowAdapter))
            } catch (e: Exception) {
                Toast.makeText(requireContext(), R.string.error_fragment_message, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun openPlayback(movie: Movie) {
        val intent = Intent(requireContext(), PlaybackActivity::class.java).apply {
            putExtra(PlaybackActivity.EXTRA_MOVIE_ID, movie.id)
            putExtra(PlaybackActivity.EXTRA_MOVIE_TITLE, movie.name)
        }
        startActivity(intent)
    }
}
