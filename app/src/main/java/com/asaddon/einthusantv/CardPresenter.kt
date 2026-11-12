package com.asaddon.einthusantv

import android.graphics.Color
import android.view.ViewGroup
import androidx.leanback.widget.ImageCardView
import androidx.leanback.widget.Presenter
import com.asaddon.einthusantv.model.Movie
import com.bumptech.glide.Glide

class CardPresenter : Presenter() {

    companion object {
        private const val CARD_WIDTH = 313
        private const val CARD_HEIGHT = 176
    }

    override fun onCreateViewHolder(parent: ViewGroup): ViewHolder {
        val cardView = ImageCardView(parent.context).apply {
            isFocusable = true
            isFocusableInTouchMode = true
            setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)
            setBackgroundColor(Color.parseColor("#1F1F1F"))
        }
        return ViewHolder(cardView)
    }

    override fun onBindViewHolder(viewHolder: ViewHolder, item: Any) {
        val movie = item as Movie
        val cardView = viewHolder.view as ImageCardView
        cardView.titleText = movie.name
        cardView.contentText = movie.releaseInfo ?: ""
        cardView.setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)

        if (!movie.poster.isNullOrBlank()) {
            Glide.with(cardView.context)
                .load(movie.poster)
                .centerCrop()
                .into(cardView.mainImageView)
        }
    }

    override fun onUnbindViewHolder(viewHolder: ViewHolder) {
        val cardView = viewHolder.view as ImageCardView
        cardView.mainImage = null
    }
}
