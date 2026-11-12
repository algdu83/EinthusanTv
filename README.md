# EinthusanTV — Application Android TV (style Netflix)

Application Android TV (Leanback) inspiree du projet [asaddon/EinthusanTV](https://github.com/asaddon/EinthusanTV)
(addon Stremio pour Einthusan.tv), avec :

- Interface de navigation TV style Netflix (rangees de cartes, fond sombre, accent rouge).
- Lecteur video plein ecran (Media3 / ExoPlayer) avec overlay de controles.
- Sous-titres francais et arabe telecharges automatiquement depuis **OpenSubtitles**.
- Sous-titres en blanc sur fond noir opaque (pas de contour).
- Boutons pour avancer / reculer le timing des sous-titres par pas de 0,5 s.

## ⚠️ Important — a lire avant de compiler

1. **Le catalogue** : le projet appelle l'addon Stremio public `https://einthusan.asaddon.com/`
   en suivant le protocole standard des addons Stremio (`/catalog/{type}/{id}.json`,
   `/stream/{type}/{id}.json`). Verifie `https://einthusan.asaddon.com/manifest.json` pour
   confirmer le `type` et le `id` exacts du catalogue, et ajuste si besoin
   `Constants.CATALOG_TYPE` / `Constants.CATALOG_ID` dans
   `app/src/main/java/com/asaddon/einthusantv/util/Constants.kt`. Si cet addon change
   d'adresse ou de schema un jour, c'est le seul fichier a modifier.

2. **Cle API OpenSubtitles (obligatoire pour les sous-titres)** : cree un compte gratuit sur
   https://www.opensubtitles.com/en/consumers puis genere une cle API (Consumer API Key).
   - En local : copie `local.properties.example` en `local.properties` et renseigne
     `OPENSUBTITLES_API_KEY=ta_cle` (ce fichier est ignore par git, ta cle ne sera jamais
     poussee sur GitHub).
   - Sur GitHub Actions : ajoute un secret de depot nomme `OPENSUBTITLES_API_KEY`
     (Settings → Secrets and variables → Actions → New repository secret). Le workflow
     fourni l'utilise automatiquement pour compiler.

3. **Wrapper Gradle** : pour garder ce depot leger, le fichier binaire
   `gradle/wrapper/gradle-wrapper.jar` n'est pas inclus (seul `gradle-wrapper.properties`
   est fourni). Deux options :
   - **Ouvrir le projet dans Android Studio** : il proposera automatiquement de regenerer
     le wrapper manquant ("Gradle wrapper is missing... create it?").
   - **En ligne de commande**, si tu as Gradle installe localement : lance `gradle wrapper
     --gradle-version 8.7` a la racine du projet pour creer `gradlew`, `gradlew.bat` et le
     jar manquant.
   - **Sur GitHub Actions**, ce n'est pas necessaire : le workflow fourni installe Gradle
     lui-meme et compile avec `gradle assembleDebug` directement.

## Compiler

### Sur GitHub (recommande, zero installation)

1. Cree un nouveau depot GitHub et pousse le contenu de ce dossier.
2. Ajoute le secret `OPENSUBTITLES_API_KEY` (voir ci-dessus).
3. Le workflow `.github/workflows/android-build.yml` se declenche automatiquement a
   chaque push sur `main`/`master` (ou manuellement via "Run workflow").
4. Une fois le build vert, recupere l'APK genere dans l'onglet **Actions → ton run →
   Artifacts → EinthusanTV-debug-apk**.

### En local avec Android Studio

1. Ouvre le dossier du projet dans Android Studio (Hedgehog ou plus recent recommande).
2. Laisse-le regenerer le wrapper Gradle si demande.
3. Cree `local.properties` avec ta cle OpenSubtitles (voir ci-dessus) et le chemin de ton
   SDK Android.
4. Lance `Build > Make Project`, puis `Run` sur un emulateur Android TV ou un vrai boitier.

## Structure du projet

```
app/src/main/java/com/asaddon/einthusantv/
├── MainActivity.kt            # Ecran d'accueil (hote du fragment Leanback)
├── MainFragment.kt            # Catalogue (BrowseSupportFragment)
├── CardPresenter.kt           # Cartes de films (affiches via Glide)
├── PlaybackActivity.kt        # Lecteur video Media3 + controles sous-titres
├── EinthusanApp.kt            # Classe Application
├── model/                     # Modeles de donnees (catalogue Stremio)
├── network/                   # Client Retrofit (addon Einthusan + OpenSubtitles)
├── subtitles/                 # Recherche/telechargement OpenSubtitles + decalage SRT
└── util/Constants.kt          # Configuration (URL addon, catalogue, etc.)
```

## Limites connues

- Le premier resultat de recherche OpenSubtitles est utilise automatiquement (pas de liste
  de choix) : tu peux enrichir `SubtitleRepository` si tu veux laisser l'utilisateur choisir
  parmi plusieurs resultats.
- L'addon Einthusan doit etre joignable publiquement depuis l'appareil (le manifeste actuel
  pointe vers `einthusan.asaddon.com`) ; si le proprietaire du depot change ou retire cette
  instance, remplace `Constants.ADDON_BASE_URL` par la tienne (tu peux deployer le serveur
  Docker officiel, voir le README original du projet).
