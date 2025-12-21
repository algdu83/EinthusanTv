const { addonBuilder, serveHTTP } = require('stremio-addon-sdk')
const axios = require('axios')
const puppeteer = require('puppeteer')

// Store session cookies per user (in memory)
const sessionCache = new Map()

// Browser instance (reused for performance)
let browserInstance = null

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ]
        })
    }
    return browserInstance
}

// Check if user is logged into Einthusan
async function checkEinthusanLogin(cookies = '') {
    try {
        const response = await axios.get('https://einthusan.tv/login/', {
            maxRedirects: 0,  // Don't follow redirects
            validateStatus: (status) => status < 400 || status === 307,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookies
            }
        })

        // 307 means logged in (redirects away from login page)
        const isLoggedIn = response.status === 307
        console.log(`Einthusan login check: ${response.status} - ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`)

        return { isLoggedIn, status: response.status }
    } catch (error) {
        // If error is due to redirect, check the status
        if (error.response?.status === 307) {
            console.log('Einthusan login check: 307 - LOGGED IN')
            return { isLoggedIn: true, status: 307 }
        }
        console.error('Einthusan login check error:', error.message)
        return { isLoggedIn: false, status: error.response?.status || 0 }
    }
}

// Login to Einthusan and get session cookies
async function loginToEinthusan(email, password) {
    try {
        // Step 1: Get the login page to get cookies and CSRF token
        const loginPageResponse = await axios.get('https://einthusan.tv/login/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        })

        // Extract cookies from login page
        const setCookies = loginPageResponse.headers['set-cookie'] || []
        const cookieString = setCookies.map(c => c.split(';')[0]).join('; ')

        // Extract data-pageid from HTML (this is the CSRF token)
        const html = loginPageResponse.data
        const pageIdMatch = html.match(/data-pageid="([^"]+)"/)
        let pageId = pageIdMatch ? pageIdMatch[1] : ''

        // Decode HTML entities (&#43; -> +, etc.)
        pageId = pageId.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        pageId = pageId.replace(/&amp;/g, '&')
        pageId = pageId.replace(/&lt;/g, '<')
        pageId = pageId.replace(/&gt;/g, '>')
        pageId = pageId.replace(/&quot;/g, '"')

        if (!pageId) {
            console.error('Could not find pageId (CSRF token) in login page')
            return { success: false, cookies: '' }
        }

        // Generate tabID like the browser does: pageId + random number
        const tabId = pageId + Math.floor(Math.random() * 1000)

        console.log('Got pageId (CSRF):', pageId.substring(0, 20) + '...')
        console.log('Generated tabID:', tabId.substring(0, 20) + '...')

        // Step 2: Perform login via AJAX endpoint
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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://einthusan.tv',
                'Referer': 'https://einthusan.tv/login/',
                'Cookie': cookieString
            }
        })

        console.log('Login response:', loginResponse.data)

        // Check if login was successful
        const success = loginResponse.data && loginResponse.data.Event === 'redirect'

        // Get updated cookies from login response
        const newCookies = loginResponse.headers['set-cookie'] || []
        const allCookies = [...setCookies, ...newCookies].map(c => c.split(';')[0]).join('; ')

        console.log(`Einthusan login: ${success ? 'SUCCESS' : 'FAILED'}`)

        return { success, cookies: allCookies }
    } catch (error) {
        console.error('Einthusan login error:', error.message)
        return { success: false, cookies: '' }
    }
}

// Convert IP-based URL to CDN URL for better compatibility
// Transform: https://28.38.198.249/etv/content/D1i6L.mp4?e=...&md5=...
//         → https://cdn2.einthusan.io/d/etv/content/D1i6L.mp4?e=...&md5=...&p=priority
function convertToCdnUrl(ipUrl, cdnIndex = 2) {
    try {
        const url = new URL(ipUrl)
        // Replace IP with CDN domain, add /d/ prefix only if not already present
        let path = url.pathname
        if (!path.startsWith('/d/')) {
            path = '/d' + path
        }
        let cdnUrl = `https://cdn${cdnIndex}.einthusan.io${path}${url.search}`
        // Ensure p=priority is in the URL
        if (!cdnUrl.includes('p=priority')) {
            cdnUrl += cdnUrl.includes('?') ? '&p=priority' : '?p=priority'
        }
        return cdnUrl
    } catch (e) {
        console.error('Error converting to CDN URL:', e.message)
        return ipUrl
    }
}

// Extract video info from HTML data attributes
// Returns: { movieCode, quality, e, md5, cdnUrl }
function extractVideoInfo(html) {
    const mp4LinkMatch = html.match(/data-mp4-link="([^"]+)"/)
    if (!mp4LinkMatch) {
        console.log('No data-mp4-link found in page')
        return null
    }

    const ipUrl = mp4LinkMatch[1].replace(/&amp;/g, '&')
    console.log('Found MP4 link:', ipUrl)

    // Parse the URL to extract components
    // Format: https://IP/etv/content/D{movieCode}.mp4?e={expiry}&md5={hash}&p=priority
    const urlMatch = ipUrl.match(/\/etv\/content\/([DB])([^.]+)\.mp4\?e=(\d+)&md5=([^&]+)/)
    if (!urlMatch) {
        console.log('Could not parse video URL format')
        return null
    }

    const [, qualityPrefix, movieCode, expiry, md5] = urlMatch
    const quality = qualityPrefix === 'B' ? 'UHD' : 'HD'

    // Convert to CDN URL
    const cdnUrl = convertToCdnUrl(ipUrl)

    return {
        movieCode,
        quality,
        qualityPrefix,
        expiry,
        md5,
        ipUrl,
        cdnUrl
    }
}

// Use Puppeteer to render the page and extract the download link
async function getDownloadLink(pageUrl, cookies, expectUHD = false) {
    const browser = await getBrowser()
    const page = await browser.newPage()

    try {
        console.log(`Rendering page with Puppeteer: ${pageUrl}`)
        console.log(`Expecting UHD: ${expectUHD}`)

        // Set cookies
        if (cookies) {
            const cookieArray = cookies.split('; ').map(c => {
                const [name, value] = c.split('=')
                return { name, value, domain: 'einthusan.tv' }
            })
            await page.setCookie(...cookieArray)
        }

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        // Navigate to page
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 })

        // Wait for the download button to be populated (JavaScript needs to run)
        await page.waitForSelector('#download-content', { timeout: 10000 })

        // Wait a bit more for JS to populate the href
        // If expecting UHD, wait for B prefix in URL
        await page.waitForFunction((expectUHD) => {
            const btn = document.querySelector('#download-content')
            if (!btn || !btn.href || btn.href.length < 10) return false
            if (expectUHD) {
                // UHD links have /B in the path
                return btn.href.includes('/B')
            }
            return true
        }, { timeout: 15000 }, expectUHD).catch(() => {
            console.log('Download button href not populated or UHD not found, using available link')
        })

        // Extract the download link
        let downloadLink = await page.evaluate(() => {
            const btn = document.querySelector('#download-content')
            return btn ? btn.href : null
        })

        // Convert IP URL to CDN URL for better playback
        if (downloadLink && downloadLink.includes('/etv/')) {
            downloadLink = convertToCdnUrl(downloadLink)
            console.log('Converted to CDN URL:', downloadLink)
        }

        // Also check if UHD is available
        const hasUHD = await page.evaluate(() => {
            return document.body.innerHTML.includes('uhd=true') ||
                   document.body.innerHTML.includes('Watch in Ultra HD')
        })

        // Get movie code from data attribute
        const movieCode = await page.evaluate(() => {
            const player = document.querySelector('#UIVideoPlayer')
            const mp4Link = player?.getAttribute('data-mp4-link') || ''
            const match = mp4Link.match(/\/([DB])([^.]+)\.mp4/)
            return match ? match[2] : null
        })

        console.log(`Download link: ${downloadLink}`)
        console.log(`Has UHD: ${hasUHD}`)
        console.log(`Movie code: ${movieCode}`)

        return { downloadLink, hasUHD, movieCode }
    } catch (error) {
        console.error('Puppeteer error:', error.message)
        return { downloadLink: null, hasUHD: false, movieCode: null }
    } finally {
        await page.close()
    }
}

// Fetch movie page and get available quality options
async function getMovieStreams(movieUrl, cookies) {
    try {
        console.log(`Fetching movie streams: ${movieUrl}`)
        const streams = []

        // Step 1: Get HD download link (default page)
        console.log('Step 1: Getting HD link...')
        const hdResult = await getDownloadLink(movieUrl, cookies)

        if (!hdResult.downloadLink) {
            console.log('No HD link found')
            return { streams: [], pageUrl: movieUrl }
        }

        console.log(`HD link: ${hdResult.downloadLink}`)
        streams.push({
            quality: 'HD',
            videoUrl: hdResult.downloadLink,
            movieCode: hdResult.movieCode,
            pageUrl: movieUrl
        })

        // Step 2: Always try to get UHD - add &uhd=true and visit
        const uhdPageUrl = movieUrl.includes('?')
            ? `${movieUrl}&uhd=true`
            : `${movieUrl}?uhd=true`

        console.log(`Step 2: Checking UHD at ${uhdPageUrl}`)
        const uhdResult = await getDownloadLink(uhdPageUrl, cookies, true)

        // Step 3: If UHD has different link, add it. Otherwise just use HD.
        if (uhdResult.downloadLink && uhdResult.downloadLink !== hdResult.downloadLink) {
            console.log(`UHD link found: ${uhdResult.downloadLink}`)
            streams.push({
                quality: 'UHD (4K)',
                videoUrl: uhdResult.downloadLink,
                movieCode: uhdResult.movieCode,
                pageUrl: uhdPageUrl
            })
        } else {
            console.log('No UHD link or same as HD, using HD only')
        }

        return { streams, pageUrl: movieUrl }
    } catch (error) {
        console.error('Error fetching movie streams:', error.message)
        return { streams: [], pageUrl: movieUrl }
    }
}

// Map OMDB language to Einthusan language code
function mapLanguageToEinthusan(language) {
    if (!language) return ''
    const lang = language.toLowerCase().split(',')[0].trim()  // Take first language if multiple
    const langMap = {
        'tamil': 'tamil',
        'hindi': 'hindi',
        'telugu': 'telugu',
        'malayalam': 'malayalam',
        'kannada': 'kannada',
        'bengali': 'bengali',
        'marathi': 'marathi',
        'punjabi': 'punjabi'
    }
    return langMap[lang] || ''  // Return empty string if not found (searches all)
}

// Search Einthusan for movies by title
async function searchEinthusan(title, cookies, language = '') {
    try {
        // Map language to Einthusan format
        const langParam = mapLanguageToEinthusan(language)
        console.log(`Movie language from OMDB: ${language} -> Einthusan lang: ${langParam || 'all'}`)

        const searchUrl = `https://einthusan.tv/movie/results/?lang=${langParam}&query=${encodeURIComponent(title)}`

        console.log(`Searching Einthusan: ${searchUrl}`)

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': cookies
            }
        })

        const html = response.data
        const movies = []

        // Parse movie results using regex
        // Each movie is in: <a class="title" href="/movie/watch/{id}/?lang={lang}"><h3>{title}</h3>
        const movieRegex = /<li>.*?<a[^>]*href="(\/movie\/watch\/[^"]+)"[^>]*>.*?<\/a>.*?<a class="title"[^>]*href="[^"]*"[^>]*><h3>([^<]+)<\/h3>(?:<span[^>]*>([^<]*)<\/span>)?<\/a>.*?<div class="info">.*?<p>(\d{4})<span>([^<]+)<\/span><\/p>.*?<p class="synopsis">([^<]*)<\/p>/gs

        let match
        while ((match = movieRegex.exec(html)) !== null) {
            const [, url, movieTitle, badge, year, language, synopsis] = match
            movies.push({
                url: `https://einthusan.tv${url}`,
                title: movieTitle.trim(),
                badge: badge?.trim() || '',
                year: year,
                language: language.trim(),
                synopsis: synopsis.trim().substring(0, 100) + '...'
            })
        }

        // Simpler fallback regex if the above doesn't work
        if (movies.length === 0) {
            const simpleRegex = /<a class="title"[^>]*href="(\/movie\/watch\/[^"]+)"[^>]*><h3>([^<]+)<\/h3>/g
            const yearRegex = /<p>(\d{4})<span>([^<]+)<\/span><\/p>/g

            const urls = [...html.matchAll(/<a[^>]*href="(\/movie\/watch\/[^"]+\?lang=[^"]+)"[^>]*>/g)]
            const titles = [...html.matchAll(/<a class="title"[^>]*><h3>([^<]+)<\/h3>/g)]
            const years = [...html.matchAll(/<p>(\d{4})<span>([^<]+)<\/span><\/p>/g)]

            // Get unique movie URLs
            const uniqueUrls = [...new Set(urls.map(m => m[1]))]

            for (let i = 0; i < Math.min(uniqueUrls.length, titles.length, years.length); i++) {
                movies.push({
                    url: `https://einthusan.tv${uniqueUrls[i]}`,
                    title: titles[i]?.[1] || 'Unknown',
                    year: years[i]?.[1] || '',
                    language: years[i]?.[2] || '',
                    synopsis: ''
                })
            }
        }

        console.log(`Found ${movies.length} movies on Einthusan`)
        return movies
    } catch (error) {
        console.error('Einthusan search error:', error.message)
        return []
    }
}

// Fetch movie info using OMDB API (free tier)
async function getMovieInfo(imdbId) {
    try {
        // Using OMDB API - free tier with API key
        const apiKey = '3e974fca'  // Free demo key - get your own at omdbapi.com
        const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`

        const response = await axios.get(url)
        const data = response.data

        if (data.Response === 'True') {
            return {
                title: data.Title || 'Unknown',
                language: data.Language || 'Unknown',
                year: data.Year || 'Unknown',
                genre: data.Genre || 'Unknown',
                country: data.Country || 'Unknown',
                imdbId: imdbId
            }
        } else {
            console.log('OMDB Error:', data.Error)
            return { title: 'Not Found', language: 'Unknown', year: 'N/A', imdbId }
        }
    } catch (error) {
        console.error('Error fetching movie info:', error.message)
        return { title: 'Error', language: 'Could not fetch', year: 'N/A', imdbId }
    }
}

// Addon manifest configuration
const manifest = {
    id: 'com.stremio.einthusan',
    version: '1.0.3',
    name: 'Einthusan',
    description: 'Stream movies from Einthusan. Developed and maintained by bmk007.',
    logo: '',
    resources: ['stream'],
    types: ['movie'],
    idPrefixes: ['tt'],  // IMDb IDs
    catalogs: [],
    // Configuration fields - shown when user installs the addon
    config: [
        {
            key: 'email',
            type: 'text',
            title: 'Einthusan Email',
            required: true
        },
        {
            key: 'password',
            type: 'password',
            title: 'Einthusan Password',
            required: true
        }
    ],
    behaviorHints: {
        configurable: true,
        configurationRequired: true  // Forces user to configure before using
    }
}

const builder = new addonBuilder(manifest)

// Stream handler - called when user clicks on a movie
builder.defineStreamHandler(async (args) => {
    const { type, id, config } = args

    // Access user credentials from config
    const email = config?.email || ''
    const password = config?.password || ''
    const cacheKey = email || 'anonymous'

    console.log(`\n=== Stream Request: ${id} ===`)

    // Step 1: Check if we have cached session cookies
    let cookies = sessionCache.get(cacheKey) || ''

    // Step 2: Check Einthusan login status
    const loginStatus = await checkEinthusanLogin(cookies)

    if (!loginStatus.isLoggedIn) {
        console.log('Not logged in, attempting login...')

        // Check if credentials are provided
        if (!email || !password) {
            // No credentials - ask user to configure
            return {
                streams: [{
                    name: 'Einthusan | Login Required',
                    description: [
                        '⚠️ Not logged into Einthusan',
                        '',
                        'Please configure the addon with your',
                        'Einthusan email and password.',
                        '',
                        'Go to: Addons → Einthusan → Configure'
                    ].join('\n'),
                    externalUrl: 'https://einthusan.tv/login/'
                }]
            }
        }

        // Try to login with credentials
        const loginResult = await loginToEinthusan(email, password)

        if (!loginResult.success) {
            return {
                streams: [{
                    name: 'Einthusan | Login Failed',
                    description: [
                        '❌ Login to Einthusan failed',
                        '',
                        'Please check your email and password.',
                        `Email: ${email}`,
                        '',
                        'Reconfigure the addon with correct credentials.'
                    ].join('\n'),
                    externalUrl: 'https://einthusan.tv/login/'
                }]
            }
        }

        // Cache the session cookies
        cookies = loginResult.cookies
        sessionCache.set(cacheKey, cookies)
        console.log('Login successful, cookies cached')
    }

    // Step 3: Now logged in - fetch movie info from IMDB
    const movieInfo = await getMovieInfo(id)
    console.log('Movie Info:', movieInfo)

    // Step 4: Search Einthusan for the movie
    const einthusanMovies = await searchEinthusan(movieInfo.title, cookies, movieInfo.language)

    // Create streams for each matching movie
    const streams = []

    if (einthusanMovies.length === 0) {
        // No results found
        streams.push({
            name: `Einthusan | No Results`,
            description: [
                `Searched for: ${movieInfo.title}`,
                `Language: ${movieInfo.language}`,
                `Year: ${movieInfo.year}`,
                '',
                'No movies found on Einthusan'
            ].join('\n'),
            externalUrl: `https://einthusan.tv/movie/results/?lang=&query=${encodeURIComponent(movieInfo.title)}`
        })
    } else {
        // Only process the first movie result for faster response
        const movie = einthusanMovies[0]
        console.log(`Processing first result: ${movie.title}`)

        // Fetch movie page and get all available quality streams
        const movieStreams = await getMovieStreams(movie.url, cookies)

        // Add stream entries for each quality (HD, UHD) - always use url, never redirect
        for (const stream of movieStreams.streams) {
            streams.push({
                name: `Einthusan | ${movie.language} | ${stream.quality}`,
                description: [
                    `${movie.title} (${movie.year})`,
                    `Quality: ${stream.quality}`,
                    stream.movieCode ? `Code: ${stream.movieCode}` : '',
                    `Language: ${movie.language}`
                ].filter(Boolean).join('\n'),
                url: stream.videoUrl,
                behaviorHints: {
                    notWebReady: false
                }
            })
        }
    }

    console.log('Returning streams to Stremio:', JSON.stringify(streams, null, 2))
    return { streams }
})

// Start the server
const PORT = process.env.PORT || 7777
const HOST = process.env.HOST || '0.0.0.0'  // Listen on all interfaces

// Get the addon interface and router
const addonInterface = builder.getInterface()

serveHTTP(addonInterface, { port: PORT })
console.log(`Addon running at http://${HOST}:${PORT}/manifest.json`)
console.log(`Configure at: http://${HOST}:${PORT}/configure`)
