package com.asaddon.einthusantv.util

/**
 * Points de configuration centraux de l'application.
 *
 * L'addon Einthusan (https://github.com/asaddon/EinthusanTV) suit le protocole standard
 * des addons Stremio : manifest.json / catalog / meta / stream. On reutilise ici
 * l'instance publique declaree dans son manifest. Si l'addon change d'adresse,
 * il suffit de changer ADDON_BASE_URL.
 *
 * Verifie le fichier manifest.json de l'addon (ADDON_BASE_URL + "manifest.json") pour
 * confirmer le "type" et le "id" exacts du catalogue si jamais ils different.
 */
object Constants {
    const val ADDON_BASE_URL = "https://einthusan.asaddon.com/"
    const val CATALOG_TYPE = "movie"
    const val CATALOG_ID = "einthusan-hindi"

    const val OPENSUBTITLES_BASE_URL = "https://api.opensubtitles.com/api/v1/"

    // Pas de cle API en dur : BuildConfig.OPENSUBTITLES_API_KEY est injecte depuis
    // local.properties (dev local) ou le secret GitHub Actions OPENSUBTITLES_API_KEY (CI).
    const val SUBTITLE_OFFSET_STEP_MS = 500L
}
