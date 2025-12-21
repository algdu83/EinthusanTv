const { addonBuilder, getRouter } = require('stremio-addon-sdk')
const axios = require('axios')

// Note: Puppeteer won't work well on Vercel serverless
// Using direct extraction instead (faster but may not get all URLs)
// No session caching - login fresh on every request (stateless for serverless)

// Login to Einthusan and get session cookies
async function loginToEinthusan(email, password) {
    try {
        console.log('Attempting login for:', email)

        const loginPageResponse = await axios.get('https://einthusan.tv/login/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        })

        const setCookies = loginPageResponse.headers['set-cookie'] || []
        const cookieString = setCookies.map(c => c.split(';')[0]).join('; ')
        console.log('Got initial cookies:', cookieString.substring(0, 50) + '...')

        const html = loginPageResponse.data
        let pageId = html.match(/data-pageid="([^"]+)"/)?.[1] || ''

        // Decode HTML entities
        pageId = pageId.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        pageId = pageId.replace(/&amp;/g, '&')
        pageId = pageId.replace(/&lt;/g, '<')
        pageId = pageId.replace(/&gt;/g, '>')
        pageId = pageId.replace(/&quot;/g, '"')

        if (!pageId) {
            console.error('Could not find pageId in login page')
            return { success: false, cookies: '' }
        }

        console.log('Got pageId:', pageId.substring(0, 30) + '...')

        const tabId = pageId + Math.floor(Math.random() * 1000)
        const loginData = new URLSearchParams({
            'xEvent': 'Login',
            'xJson': JSON.stringify({ Email: email, Password: password }),
            'arcVersion': '12',
            'appVersion': '352',
            'tabID': tabId,
            'gorilla.csrf.Token': pageId
        })

        const loginResponse = await axios.post('https://einthusan.tv/ajax/login/', loginData.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://einthusan.tv',
                'Referer': 'https://einthusan.tv/login/',
                'Cookie': cookieString
            }
        })

        console.log('Login response:', JSON.stringify(loginResponse.data))

        const success = loginResponse.data?.Event === 'redirect'
        const newCookies = loginResponse.headers['set-cookie'] || []
        const allCookies = [...setCookies, ...newCookies].map(c => c.split(';')[0]).join('; ')

        console.log('Login success:', success)
        console.log('All cookies:', allCookies.substring(0, 50) + '...')

        return { success, cookies: allCookies }
    } catch (error) {
        console.error('Einthusan login error:', error.message)
        if (error.response) {
            console.error('Response status:', error.response.status)
            console.error('Response data:', error.response.data)
        }
        return { success: false, cookies: '' }
    }
}

// Convert IP-based URL to CDN URL
function convertToCdnUrl(ipUrl, cdnIndex = 2) {
    try {
        const url = new URL(ipUrl)
        let cdnUrl = `https://cdn${cdnIndex}.einthusan.io/d${url.pathname}${url.search}`
        if (!cdnUrl.includes('p=priority')) {
            cdnUrl += cdnUrl.includes('?') ? '&p=priority' : '?p=priority'
        }
        return cdnUrl
    } catch (e) {
        return ipUrl
    }
}

// Extract video URL from HTML (without Puppeteer)
function extractVideoUrl(html) {
    const mp4LinkMatch = html.match(/data-mp4-link="([^"]+)"/)
    if (mp4LinkMatch) {
        const ipUrl = mp4LinkMatch[1].replace(/&amp;/g, '&')
        // Try CDN URL first, fallback to IP URL
        const cdnUrl = convertToCdnUrl(ipUrl)
        console.log('IP URL:', ipUrl)
        console.log('CDN URL:', cdnUrl)
        return cdnUrl
    }

    // Fallback: try to find HLS link
    const hlsMatch = html.match(/data-hls-link="([^"]+)"/)
    if (hlsMatch) {
        const hlsUrl = hlsMatch[1].replace(/&amp;/g, '&')
        return convertToCdnUrl(hlsUrl)
    }

    return null
}

// Fetch movie page and get streams
async function getMovieStreams(movieUrl, cookies) {
    try {
        const response = await axios.get(movieUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Cookie': cookies
            }
        })

        const html = response.data
        const streams = []
        const hasUHD = html.includes('uhd=true')

        const hdUrl = extractVideoUrl(html)
        if (hdUrl) {
            streams.push({ quality: 'HD', videoUrl: hdUrl, pageUrl: movieUrl })
        }

        if (hasUHD) {
            const uhdPageUrl = movieUrl.includes('?') ? `${movieUrl}&uhd=true` : `${movieUrl}?uhd=true`
            try {
                const uhdResponse = await axios.get(uhdPageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Cookie': cookies
                    }
                })
                const uhdUrl = extractVideoUrl(uhdResponse.data)
                if (uhdUrl && uhdUrl !== hdUrl) {
                    streams.push({ quality: 'UHD (4K)', videoUrl: uhdUrl, pageUrl: uhdPageUrl })
                }
            } catch (e) {}
        }

        return { hasUHD, streams, pageUrl: movieUrl }
    } catch (error) {
        return { hasUHD: false, streams: [], pageUrl: movieUrl }
    }
}

// Map language to Einthusan format
function mapLanguageToEinthusan(language) {
    if (!language) return ''
    const lang = language.toLowerCase().split(',')[0].trim()
    const langMap = {
        'tamil': 'tamil', 'hindi': 'hindi', 'telugu': 'telugu',
        'malayalam': 'malayalam', 'kannada': 'kannada', 'bengali': 'bengali',
        'marathi': 'marathi', 'punjabi': 'punjabi'
    }
    return langMap[lang] || ''
}

// Search Einthusan
async function searchEinthusan(title, cookies, language = '') {
    try {
        const langParam = mapLanguageToEinthusan(language)
        const searchUrl = `https://einthusan.tv/movie/results/?lang=${langParam}&query=${encodeURIComponent(title)}`

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Cookie': cookies
            }
        })

        const html = response.data
        const movies = []

        const urls = [...html.matchAll(/<a[^>]*href="(\/movie\/watch\/[^"]+\?lang=[^"]+)"[^>]*>/g)]
        const titles = [...html.matchAll(/<a class="title"[^>]*><h3>([^<]+)<\/h3>/g)]
        const years = [...html.matchAll(/<p>(\d{4})<span>([^<]+)<\/span><\/p>/g)]

        const uniqueUrls = [...new Set(urls.map(m => m[1]))]

        for (let i = 0; i < Math.min(uniqueUrls.length, titles.length, years.length); i++) {
            movies.push({
                url: `https://einthusan.tv${uniqueUrls[i]}`,
                title: titles[i]?.[1] || 'Unknown',
                year: years[i]?.[1] || '',
                language: years[i]?.[2] || ''
            })
        }

        return movies
    } catch (error) {
        return []
    }
}

// Get movie info from OMDB
async function getMovieInfo(imdbId) {
    try {
        const apiKey = '3e974fca'
        const response = await axios.get(`https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`)
        const data = response.data
        if (data.Response === 'True') {
            return {
                title: data.Title || 'Unknown',
                language: data.Language || 'Unknown',
                year: data.Year || 'Unknown',
                imdbId
            }
        }
        return { title: 'Not Found', language: 'Unknown', year: 'N/A', imdbId }
    } catch (error) {
        return { title: 'Error', language: 'Unknown', year: 'N/A', imdbId }
    }
}

// Addon manifest
const manifest = {
    id: 'com.stremio.einthusan',
    version: '1.0.3',
    name: 'Einthusan',
    description: 'Stream movies from Einthusan. Developed and maintained by bmk007.',
    logo: 'https://www.einthusan.tv/etc/favicon-32x32.png',
    resources: ['stream'],
    types: ['movie'],
    idPrefixes: ['tt'],
    catalogs: [],
    config: [
        { key: 'email', type: 'text', title: 'Einthusan Email', required: true },
        { key: 'password', type: 'password', title: 'Einthusan Password', required: true }
    ],
    behaviorHints: {
        configurable: true,
        configurationRequired: true
    }
}

const builder = new addonBuilder(manifest)

// Stream handler
builder.defineStreamHandler(async (args) => {
    const { id, config } = args
    const email = config?.email || ''
    const password = config?.password || ''

    // Always require credentials
    if (!email || !password) {
        return {
            streams: [{
                name: 'Einthusan | Login Required',
                description: 'Please configure the addon with your Einthusan credentials.',
                externalUrl: 'https://einthusan.tv/login/'
            }]
        }
    }

    // Login fresh on every request (stateless)
    console.log('Logging in fresh for:', email)
    const loginResult = await loginToEinthusan(email, password)
    if (!loginResult.success) {
        return {
            streams: [{
                name: 'Einthusan | Login Failed',
                description: 'Please check your email and password.',
                externalUrl: 'https://einthusan.tv/login/'
            }]
        }
    }

    const cookies = loginResult.cookies
    const movieInfo = await getMovieInfo(id)
    const einthusanMovies = await searchEinthusan(movieInfo.title, cookies, movieInfo.language)

    const streams = []

    if (einthusanMovies.length === 0) {
        streams.push({
            name: 'Einthusan | No Results',
            description: `No results for: ${movieInfo.title}`,
            externalUrl: `https://einthusan.tv/movie/results/?query=${encodeURIComponent(movieInfo.title)}`
        })
    } else {
        for (const movie of einthusanMovies) {
            const movieStreams = await getMovieStreams(movie.url, cookies)

            if (movieStreams.streams.length === 0) {
                streams.push({
                    name: `Einthusan | ${movie.language}`,
                    description: `${movie.title} (${movie.year})`,
                    externalUrl: movie.url
                })
            } else {
                for (const stream of movieStreams.streams) {
                    streams.push({
                        name: `Einthusan | ${movie.language} | ${stream.quality}`,
                        description: `${movie.title} (${movie.year}) - ${stream.quality}`,
                        url: stream.videoUrl,
                        behaviorHints: { notWebReady: false }
                    })
                }
            }
        }
    }

    return { streams }
})

// Export for Vercel serverless
const addonInterface = builder.getInterface()

// Custom configure page HTML
function getConfigurePage(host) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Einthusan - Stremio Addon</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .container {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 450px;
            width: 100%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .logo {
            text-align: center;
            margin-bottom: 20px;
        }
        .logo img {
            width: 64px;
            height: 64px;
            border-radius: 12px;
        }
        h1 {
            color: #fff;
            text-align: center;
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        .subtitle {
            color: #aaa;
            text-align: center;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            color: #ccc;
            margin-bottom: 8px;
            font-size: 14px;
        }
        input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            background: rgba(0,0,0,0.3);
            color: #fff;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #8b5cf6;
        }
        input::placeholder {
            color: #666;
        }
        .btn {
            width: 100%;
            padding: 16px;
            border: none;
            border-radius: 10px;
            background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            color: #fff;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            margin-top: 10px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
        }
        .btn:active {
            transform: translateY(0);
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
        }
        .footer a {
            color: #8b5cf6;
            text-decoration: none;
        }
        .error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid #ef4444;
            color: #fca5a5;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: none;
        }
        .manual-link {
            margin-top: 20px;
            padding: 15px;
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
            display: none;
        }
        .manual-link label {
            margin-bottom: 10px;
        }
        .manual-link input {
            font-size: 12px;
            padding: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <img src="https://www.einthusan.tv/etc/favicon-32x32.png" alt="Einthusan">
        </div>
        <h1>Einthusan</h1>
        <p class="subtitle">Stream South Asian movies in Stremio<br>Developed by bmk007</p>

        <div class="error" id="error"></div>

        <form id="configForm">
            <div class="form-group">
                <label for="email">Einthusan Email</label>
                <input type="email" id="email" name="email" placeholder="your@email.com" required>
            </div>
            <div class="form-group">
                <label for="password">Einthusan Password</label>
                <input type="password" id="password" name="password" placeholder="••••••••" required>
            </div>
            <button type="submit" class="btn">Install Addon</button>
        </form>

        <div class="manual-link" id="manualLink">
            <label>Or copy this link and paste in Stremio:</label>
            <input type="text" id="addonUrl" readonly onclick="this.select()">
        </div>

        <div class="footer">
            <p>Need an account? <a href="https://einthusan.tv/register/" target="_blank">Sign up at Einthusan</a></p>
        </div>
    </div>

    <script>
        const host = '${host}';

        document.getElementById('configForm').addEventListener('submit', function(e) {
            e.preventDefault();

            const email = encodeURIComponent(document.getElementById('email').value);
            const password = encodeURIComponent(document.getElementById('password').value);

            // Create the addon URL with config
            const configuredUrl = host + '/' + email + '/' + password + '/manifest.json';
            const stremioUrl = 'stremio://' + host.replace('https://', '').replace('http://', '') + '/' + email + '/' + password + '/manifest.json';

            // Show manual link
            document.getElementById('addonUrl').value = configuredUrl;
            document.getElementById('manualLink').style.display = 'block';

            // Try to open Stremio
            window.location.href = stremioUrl;
        });
    </script>
</body>
</html>`
}

module.exports = async (req, res) => {
    // Get the host from request
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = protocol + '://' + req.headers.host

    const url = new URL(req.url, host)
    const pathParts = url.pathname.split('/').filter(Boolean)

    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

    if (req.method === 'OPTIONS') {
        res.statusCode = 200
        res.end()
        return
    }

    // Route: / or /configure - show config page
    if (url.pathname === '/' || url.pathname === '/configure') {
        res.setHeader('Content-Type', 'text/html')
        res.end(getConfigurePage(host))
        return
    }

    // Route: /manifest.json (unconfigured)
    if (url.pathname === '/manifest.json') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(addonInterface.manifest))
        return
    }

    // Route: /{email}/{password}/manifest.json (configured - no config required)
    if (pathParts.length === 3 && pathParts[2] === 'manifest.json') {
        // Return manifest WITHOUT configurationRequired for configured addons
        const configuredManifest = {
            ...addonInterface.manifest,
            behaviorHints: {
                configurable: false,
                configurationRequired: false
            }
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(configuredManifest))
        return
    }

    // Route: /{email}/{password}/configure (configured addon settings)
    if (pathParts.length === 3 && pathParts[2] === 'configure') {
        res.setHeader('Content-Type', 'text/html')
        res.end(getConfigurePage(host))
        return
    }

    // Route: /{email}/{password}/stream/{type}/{id}.json
    if (pathParts.length >= 5 && pathParts[2] === 'stream') {
        const email = decodeURIComponent(pathParts[0])
        const password = decodeURIComponent(pathParts[1])
        const type = pathParts[3]
        const id = pathParts[4]?.replace('.json', '')

        try {
            const response = await addonInterface.get({
                resource: 'stream',
                type,
                id,
                extra: { config: { email, password } }
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(response))
        } catch (err) {
            // Try with config in different format
            try {
                const streams = await handleStreamRequest(id, email, password)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(streams))
            } catch (err2) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: err2.message }))
            }
        }
        return
    }

    // Route: /stream/{type}/{id}.json (unconfigured - will show login required)
    if (pathParts.length >= 3 && pathParts[0] === 'stream') {
        const type = pathParts[1]
        const id = pathParts[2]?.replace('.json', '')

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
            streams: [{
                name: 'Einthusan | Not Configured',
                description: 'Please configure the addon with your Einthusan credentials at:\\n' + host,
                externalUrl: host
            }]
        }))
        return
    }

    res.statusCode = 404
    res.end('Not Found')
}

// Direct stream handler for configured requests
async function handleStreamRequest(imdbId, email, password) {
    // Always require credentials
    if (!email || !password) {
        return { streams: [{ name: 'Einthusan | Login Required', description: 'Configure addon first', externalUrl: 'https://einthusan.tv' }] }
    }

    // Login fresh on every request (stateless)
    console.log('Logging in fresh for:', email)
    const loginResult = await loginToEinthusan(email, password)
    if (!loginResult.success) {
        return { streams: [{ name: 'Einthusan | Login Failed', description: 'Check credentials', externalUrl: 'https://einthusan.tv' }] }
    }

    const cookies = loginResult.cookies
    const movieInfo = await getMovieInfo(imdbId)
    const einthusanMovies = await searchEinthusan(movieInfo.title, cookies, movieInfo.language)

    const streams = []

    if (einthusanMovies.length === 0) {
        streams.push({
            name: 'Einthusan | No Results',
            description: [
                'Searched for: ' + movieInfo.title,
                'Language: ' + movieInfo.language,
                'Year: ' + movieInfo.year,
                '',
                'No movies found on Einthusan'
            ].join('\n'),
            externalUrl: 'https://einthusan.tv/movie/results/?query=' + encodeURIComponent(movieInfo.title)
        })
    } else {
        for (const movie of einthusanMovies) {
            const movieStreams = await getMovieStreams(movie.url, cookies)

            if (movieStreams.streams.length === 0) {
                streams.push({
                    name: 'Einthusan | ' + movie.language,
                    description: [
                        movie.title + ' (' + movie.year + ')',
                        'Language: ' + movie.language
                    ].join('\n'),
                    externalUrl: movie.url
                })
            } else {
                for (const stream of movieStreams.streams) {
                    streams.push({
                        name: 'Einthusan | ' + movie.language + ' | ' + stream.quality,
                        description: [
                            movie.title + ' (' + movie.year + ')',
                            'Quality: ' + stream.quality,
                            'Language: ' + movie.language
                        ].join('\n'),
                        url: stream.videoUrl,
                        behaviorHints: { notWebReady: false }
                    })
                }
            }
        }
    }

    return { streams }
}
