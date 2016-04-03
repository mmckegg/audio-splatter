var WebSocketServer = require('ws').Server
var ndarray = require('ndarray')
var Browserify = require('browserify')

module.exports = function (port) {
  var server = require('http').createServer()
  var wss = new WebSocketServer({ server: server })
  var connections = []

  wss.on('connection', function connection (ws) {
    connections.push(ws)
    ws.on('end', function () {
      connections.splice(connections.indexOf(ws), 1)
    })
  })

  server.on('request', function (req, res) {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<!DOCTYPE HTML><html><head><style>html, body { overflow: hidden; }</style></head><body scroll="no"><script src="/bundle.js"></script></body></html>')
    } else if (req.url === '/bundle.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' })
      var b = Browserify({ ignoreMissing: true })
      b.add(__dirname + '/client.js')
      b.bundle().pipe(res)
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  server.listen(port || 8080)

  var send = function (pixels) {
    connections.forEach(function (socket) {
      socket.send(pixels.data, { binary: true })
    })
  }

  send.close = function () {
    server.close()
  }

  return send
}
