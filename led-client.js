var WebSocket = window.WebSocket

module.exports = function (url) {
  var ws = new WebSocket(url || 'ws://localhost:8080')

  var send = function (pixels) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(pixels.data.buffer)
    } else {
      return false
    }
  }

  send.close = function () {
    ws.close()
  }

  return send
}
