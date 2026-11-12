package com.einthusan.tv.model

/**
 * Représente un contenu (film/série) affiché dans les rangées façon Netflix.
 * streamUrl : URL du flux vidéo à lire (à brancher sur la source Einthusan réelle).
 */
data class Movie(
    val id: String,
    val title: String,
    val description: String,
    val cardImageUrl: String,
    val backgroundImageUrl: String,
    val streamUrl: String,
    val category: String
)
