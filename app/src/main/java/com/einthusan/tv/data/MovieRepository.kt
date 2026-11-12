package com.einthusan.tv.data

import com.einthusan.tv.model.Movie

/**
 * À REMPLACER : ce dépôt renvoie des données d'exemple.
 * Branche ici l'appel réel vers la source de contenu Einthusan (API/scraping)
 * pour remplir les rangées avec le vrai catalogue (titres, images, URL de flux).
 */
object MovieRepository {

    fun getCategories(): List<String> = listOf(
        "Continuer à regarder",
        "Tendances",
        "Films Hindi",
        "Films Tamil",
        "Films Telugu"
    )

    fun getMoviesForCategory(category: String): List<Movie> = listOf(
        Movie(
            id = "demo1",
            title = "Exemple de film 1",
            description = "Description à remplacer par les vraies données Einthusan.",
            cardImageUrl = "",
            backgroundImageUrl = "",
            streamUrl = "https://example.com/stream1.m3u8",
            category = category
        ),
        Movie(
            id = "demo2",
            title = "Exemple de film 2",
            description = "Description à remplacer par les vraies données Einthusan.",
            cardImageUrl = "",
            backgroundImageUrl = "",
            streamUrl = "https://example.com/stream2.m3u8",
            category = category
        )
    )
}
