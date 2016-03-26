var getFrame = require('./lib/pixels-apa102')
var connect = require('./lib/ftdi-spi')
var hslToRgb = require('./lib/hsl-to-rgb')
var NdArray = require('ndarray')
var listen = require('./server')

var stripLength = 60 * 6
var rate = 100 // fps
var spread = 1
var hueOffset = 0.001
var smoothing = 0.8
var minDecibels = -70
var maxDecibels = -5
var channel = 0

var container = document.createElement('div')
container.style.display = 'flex'
container.style.position = 'absolute'
container.style.top = container.style.bottom = container.style.left = container.style.right = 0

for (var i = 0; i < stripLength; i++) {
  var element = document.createElement('div')
  element.style.flex = '1'
  element.style.backgroundColor = 'rgb(0,0,0)'
  container.appendChild(element)
}

function preview (state) {
  for (var i = 0; i < state.shape[0]; i++) {
    container.childNodes[i].style.backgroundColor = `rgb(${state.get(i, 0)}, ${state.get(i, 1)}, ${state.get(i, 2)})`
  }
}

document.body.appendChild(container)

var audioContext = new window.AudioContext()
var send = connect(channel)

var lastMessageAt = null

listen(8080, function (pixels) {
  send(getFrame(pixels))
  preview(pixels)
  lastMessageAt = Date.now()
})

var analysers = []
navigator.mediaDevices.getUserMedia({audio: true}).then(function (stream) {
  var input = audioContext.createMediaStreamSource(stream)
  var channels = getAnalysers(input)
  analysers.push([channels[0], channels[1]])
})

var valuesL = new Uint8Array(4096)
var valuesR = new Uint8Array(4096)
var layerL = Strand(stripLength)
var layerR = Strand(stripLength)

var t = 0

function tick () {
  if (lastMessageAt > Date.now() - 100) {
    // overriding
    return
  }

  var state = Strand(stripLength)
  t += 1

  for (var i = 0; i < analysers.length; i++) {
    analysers[i][0].getByteFrequencyData(valuesL)
    analysers[i][1].getByteFrequencyData(valuesR)
    var hue = (Date.now() % 10000) / 10000
    var lastSel = 0
    for (var x = 0; x < stripLength / 2; x++) {
      var sel = Math.floor(Math.pow(x, spread))
      var lL = average(valuesL, lastSel, sel) / 256
      var lR = average(valuesR, lastSel, sel) / 256
      var mult = (0.8 + (sel / valuesL.length))
      set(layerL, (stripLength / 2) - x, hslToRgb(hue + (hueOffset * x), 1, lL * mult))
      set(layerR, (stripLength / 2) + x, hslToRgb(hue + (hueOffset * x), 1, lR * mult))
      lastSel = sel
    }

    overlay(state.data, layerL.data)
    overlay(state.data, layerR.data)
  }

  send(getFrame(state))
  preview(state)
}

setInterval(tick, 1000 / rate)

function overlay (target, arr) {
  for (var i = 0; i < target.length; i++) {
    target[i] = Math.min(arr[i] + target[i], 255)
  }
}

function average (array, from, to) {
  var sum = 0
  var count = 0
  for (var i = from; i <= to; i++) {
    sum += array[i]
    count += 1
  }
  return (sum / count) || 0
}

function Strand (length) {
  return NdArray(new Uint8Array(length * 3), [length, 3])
}

function set (target, x, rgb) {
  target.set(x, 0, rgb[0])
  target.set(x, 1, rgb[1])
  target.set(x, 2, rgb[2])
}

function getAnalysers (output) {
  var splitter = output.context.createChannelSplitter()
  splitter.channelCountMode = 'explicit'
  splitter.channelCount = 2
  output.connect(splitter)

  var result = []
  result.push(getAnalyser(splitter, 0))
  if (output.channelCount > 1) {
    result.push(getAnalyser(splitter, 1))
  }

  return result
}

function getAnalyser (splitter, channel) {
  var analyser = splitter.context.createAnalyser()
  analyser.smoothingTimeConstant = smoothing
  analyser.minDecibels = minDecibels
  analyser.maxDecibels = maxDecibels
  analyser.fftSize = 2048
  splitter.connect(analyser, channel)
  return analyser
}
