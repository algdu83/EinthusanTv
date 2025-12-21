const { addonBuilder, getRouter } = require('stremio-addon-sdk')
const axios = require('axios')

// Note: Puppeteer won't work well on Vercel serverless
// Using direct extraction instead (faster but may not get all URLs)

// Store session cookies per user (in memory - will reset on cold starts)
const sessionCache = new Map()

// Check if user is logged into Einthusan
async function checkEinthusanLogin(cookies = '') {
    try {
        const response = await axios.get('https://einthusan.tv/login/', {
            maxRedirects: 0,
            validateStatus: (status) => status < 400 || status === 307,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookies
            }
        })
        const isLoggedIn = response.status === 307
        console.log(`Einthusan login check: ${response.status} - ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`)
        return { isLoggedIn, status: response.status }
    } catch (error) {
        if (error.response?.status === 307) {
            return { isLoggedIn: true, status: 307 }
        }
        console.error('Einthusan login check error:', error.message)
        return { isLoggedIn: false, status: error.response?.status || 0 }
    }
}

// Login to Einthusan and get session cookies
async function loginToEinthusan(email, password) {
    try {
        const loginPageResponse = await axios.get('https://einthusan.tv/login/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        })

        const setCookies = loginPageResponse.headers['set-cookie'] || []
        const cookieString = setCookies.map(c => c.split(';')[0]).join('; ')

        const html = loginPageResponse.data
        let pageId = html.match(/data-pageid="([^"]+)"/)?.[1] || ''
        pageId = pageId.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        pageId = pageId.replace(/&amp;/g, '&')

        if (!pageId) {
            return { success: false, cookies: '' }
        }

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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://einthusan.tv',
                'Referer': 'https://einthusan.tv/login/',
                'Cookie': cookieString
            }
        })

        const success = loginResponse.data?.Event === 'redirect'
        const newCookies = loginResponse.headers['set-cookie'] || []
        const allCookies = [...setCookies, ...newCookies].map(c => c.split(';')[0]).join('; ')

        return { success, cookies: allCookies }
    } catch (error) {
        console.error('Einthusan login error:', error.message)
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
        return convertToCdnUrl(ipUrl)
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
    const cacheKey = email || 'anonymous'

    let cookies = sessionCache.get(cacheKey) || ''
    const loginStatus = await checkEinthusanLogin(cookies)

    if (!loginStatus.isLoggedIn) {
        if (!email || !password) {
            return {
                streams: [{
                    name: 'Einthusan | Login Required',
                    description: 'Please configure the addon with your Einthusan credentials.',
                    externalUrl: 'https://einthusan.tv/login/'
                }]
            }
        }

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

        cookies = loginResult.cookies
        sessionCache.set(cacheKey, cookies)
    }

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
const router = getRouter(addonInterface)

module.exports = (req, res) => {
    // Handle the request with the addon router
    router(req, res, () => {
        res.statusCode = 404
        res.end('Not Found')
    })
}
