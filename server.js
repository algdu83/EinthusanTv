const http = require('http')
const handler = require('./api/index.js')

const PORT = process.env.PORT || 7777

const server = http.createServer((req, res) => {
    handler(req, res)
})

server.listen(PORT, () => {
    console.log(`Einthusan addon running on port ${PORT}`)
})
