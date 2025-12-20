# Einthusan Stremio Addon 
# Buy me a Coffee https://buymeacoffee.com/bmk007

> **Coming to Stremio Community Addon Repository soon!**

A Stremio addon that allows you to stream movies from Einthusan directly in the Stremio media player. Watch South Asian movies (Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi) seamlessly without leaving Stremio.

**Developed and maintained by bmk007**

---

## Features

- **Direct Streaming**: Play movies directly in Stremio's built-in player
- **Multiple Languages**: Supports all Einthusan languages (Tamil, Hindi, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi)
- **Quality Options**: Automatically detects and offers HD and UHD (4K) quality when available
- **Automatic Login**: Securely handles Einthusan authentication using your credentials
- **IMDB Integration**: Matches movies using IMDB IDs for accurate results
- **Session Management**: Caches login sessions for faster subsequent requests
- **Cross-Device Sync**: Configure once, use on all devices with the same Stremio account

---

## How It Works

1. **Movie Selection**: When you click on a movie in Stremio, the addon receives the IMDB ID
2. **Movie Info Lookup**: Fetches movie details (title, language, year) from OMDB API
3. **Einthusan Search**: Searches Einthusan for matching movies using the title
4. **Authentication**: If not logged in, automatically authenticates using your stored credentials
5. **Stream Extraction**: Uses a headless browser to render the movie page and extract the actual download/stream URL
6. **Quality Detection**: Checks for available quality options (HD with 'D' prefix, UHD with 'B' prefix)
7. **Playback**: Returns the CDN URL for direct playback in Stremio

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A valid Einthusan account (free or premium)
- Stremio installed on your device

---

## Installation

### Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/einthusan-stremio.git
   cd einthusan-stremio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the addon**
   ```bash
   node addon.js
   ```

4. **Install in Stremio**
   - Open Stremio
   - Go to Addons
   - Click on "Community Addons" or enter the addon URL manually:
     ```
     http://localhost:7777/manifest.json
     ```
   - Configure with your Einthusan email and password
   - Click Install

### Server Installation (For Remote Access)

1. **Clone and install on your server**
   ```bash
   git clone https://github.com/yourusername/einthusan-stremio.git
   cd einthusan-stremio
   npm install
   ```

2. **Install PM2 for process management (recommended)**
   ```bash
   npm install -g pm2
   pm2 start addon.js --name einthusan-addon
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start
   ```

3. **Configure firewall (if needed)**
   ```bash
   # Allow port 7777
   sudo ufw allow 7777
   ```

4. **Install in Stremio using your server's IP/domain**
   ```
   http://YOUR_SERVER_IP:7777/manifest.json
   ```

---

## Configuration

When you install the addon in Stremio, you'll be prompted to enter:

| Field | Description |
|-------|-------------|
| **Email** | Your Einthusan account email |
| **Password** | Your Einthusan account password |

These credentials are:
- Stored securely by Stremio (not in the addon code)
- Synced across devices when using the same Stremio account
- Used only to authenticate with Einthusan

---

## Usage

1. **Search for a movie** in Stremio using its title
2. **Click on the movie** to see available streams
3. **Look for "Einthusan"** streams in the list
4. **Select your preferred quality** (HD or UHD if available)
5. **Enjoy!** The movie will play directly in Stremio

### Stream Information

Each stream displays:
- **Language**: The movie's language (Tamil, Hindi, Telugu, etc.)
- **Quality**: HD or UHD (4K)
- **Movie Code**: Einthusan's internal movie identifier
- **Title and Year**: Movie details

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7777` | Port to run the addon server |
| `HOST` | `0.0.0.0` | Host to bind the server |

Example:
```bash
PORT=8080 node addon.js
```

---

## Technical Details

### Dependencies

| Package | Purpose |
|---------|---------|
| `stremio-addon-sdk` | Stremio addon framework |
| `axios` | HTTP requests for API calls |
| `puppeteer` | Headless browser for page rendering |

### API Endpoints Used

- **OMDB API**: For fetching movie information from IMDB IDs
- **Einthusan**: For searching and streaming movies

### URL Format

Einthusan CDN URLs follow this pattern:
```
https://cdn{1-4}.einthusan.io/d/etv/content/{quality}{movieCode}.mp4?e={expiry}&md5={hash}&p=priority
```

Where:
- `quality`: `D` for HD, `B` for UHD
- `movieCode`: Einthusan's internal movie identifier
- `expiry`: Unix timestamp for URL expiration
- `md5`: Authentication hash

---

## Troubleshooting

### Addon takes too long to load
The first request may be slow as Puppeteer launches. Subsequent requests are faster due to browser reuse.

### Login failed
- Verify your Einthusan credentials are correct
- Check if your Einthusan account is active
- Try logging into Einthusan website directly to confirm

### No streams found
- The movie may not be available on Einthusan
- Try searching with the exact movie title
- Check if the movie is available in your region

### Stream won't play
- The stream URL may have expired (they have time-limited tokens)
- Try clicking on the movie again to get a fresh URL
- Check your internet connection

---

## Project Structure

```
einthusan-stremio/
├── addon.js          # Main addon code
├── package.json      # Node.js dependencies
├── package-lock.json # Dependency lock file
└── README.md         # This file
```

---

## Security & Privacy

- **No credentials stored in code**: Your email/password are entered through Stremio's configuration and stored by Stremio
- **Session caching**: Login sessions are cached in memory only (cleared on restart)
- **No data collection**: The addon does not collect or transmit any user data
- **HTTPS CDN**: Streams are served over HTTPS from Einthusan's CDN

---

## Disclaimer

This addon is for personal use only. It requires a valid Einthusan account. Please respect Einthusan's terms of service and support content creators by subscribing to Einthusan Premium if you enjoy their service.

---

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

## License

MIT License - Feel free to use, modify, and distribute.

---

## Credits

- **Developer**: bmk007
- **Stremio SDK**: [Stremio Addon SDK](https://github.com/Stremio/stremio-addon-sdk)
- **OMDB API**: [omdbapi.com](https://www.omdbapi.com/)

---

## Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check existing issues for solutions

---

**Enjoy streaming!**
