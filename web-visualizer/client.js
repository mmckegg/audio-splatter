var PixelCanvas = require('pixels-canvas')
var NdArray = require('ndarray')
var ws = new window.WebSocket('ws://' + window.location.host)
ws.binaryType = 'arraybuffer'

var canvas = document.createElement('canvas')
canvas.width = 500
canvas.height = 1

var render = PixelCanvas(canvas)
document.body.appendChild(canvas)
document.body.style.margin = '0'
document.lastChild.style.height = document.body.style.height = canvas.style.height = '100%'
canvas.style.width = '100%'

ws.onmessage = function (e) {
  var data = new Uint8Array(e.data)
  var pixels = NdArray(data, [data.length / 3, 1, 3])
  pixels.format = 'rgb'
  render(pixels)
}
