var WebSocketServer = require('ws').Server
var ndarray = require('ndarray')

module.exports = function (port, listener) {
  var server = require('http').createServer()
  var wss = new WebSocketServer({ server: server })
  var connections = []

  wss.on('connection', function connection (ws) {
    console.log('connection')
    connections.push(ws)

    ws.on('message', function (data, flags) {
      if (flags.binary) {
        listener(ndarray(data, [data.length / 3, 3]))
      }
    })
    ws.on('end', function () {
      connections.splice(connections.indexOf(ws), 1)
    })
  })

  server.listen(port || 8080)
}
