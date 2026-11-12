package com.einthusan.tv.ui

import android.graphics.Color
import android.view.ViewGroup
import androidx.leanback.widget.ImageCardView
import androidx.leanback.widget.Presenter
import com.einthusan.tv.model.Movie

/** Affiche chaque film comme une carte image (format Netflix) dans les rangées. */
class CardPresenter : Presenter() {

    override fun onCreateViewHolder(parent: ViewGroup): ViewHolder {
        val cardView = ImageCardView(parent.context).apply {
            isFocusable = true
            isFocusableInTouchMode = true
            setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)
            setBackgroundColor(Color.parseColor("#1a1a1a"))
        }
        return ViewHolder(cardView)
    }

    override fun onBindViewHolder(viewHolder: ViewHolder, item: Any) {
        val movie = item as Movie
        val cardView = viewHolder.view as ImageCardView
        cardView.titleText = movie.title
        cardView.contentText = movie.category
        cardView.setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)
        // Charger movie.cardImageUrl dans cardView.mainImageView avec la librairie
        // d'images de ton choix (Glide/Coil) — non incluse ici pour rester léger.
    }

    override fun onUnbindViewHolder(viewHolder: ViewHolder) {
        (viewHolder.view as ImageCardView).mainImage = null
    }

    companion object {
        private const val CARD_WIDTH = 313
        private const val CARD_HEIGHT = 176
    }
}
