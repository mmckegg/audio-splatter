var ObservStruct = require('observ-struct')
var RemoteLEDs = require('./led-client')
var NdArray = require('ndarray')

module.exports = Visualizer

function Visualizer (context) {
  var obs = ObservStruct({
    //port: midiPort
  })

  var sendToLEDs = RemoteLEDs('ws://localhost:1337')

  var width = 60 * 6
  var spread = 1.1
  var project = context.project
  var analysers = []

  project.items.onLoad(function (item) {
    var analysersForChunk = []
    if (item.node._type === 'LoopDropSetup') {
      setTimeout(function () {
        var chunks = getOutputChunks(item.node.chunks)
        chunks.forEach(function (chunk, i) {
          var node = chunk.node || chunk
          var output = node.context.output

          var channels = getAnalysers(output)

          var hue = (1 / chunks.length) * i
          var item = [channels[0], channels[1] || channels[0], chunk, hue]
          analysersForChunk.push(item)
          analysers.push(item)
        })
      }, 1000)

      item.onClose(function () {
        analysersForChunk.forEach(function (item) {
          var index = analysers.indexOf(item)
          if (~index) {
            analysers.splice(item, index)
          }
        })
      })
    }
  })

  var valuesL = new Uint8Array(4096)
  var valuesR = new Uint8Array(4096)
  var layerL = Strand(width)
  var layerR = Strand(width)

  function tick () {
    var state = Strand(width)

    for (var i = 0; i < analysers.length; i++) {
      analysers[i][0].getByteFrequencyData(valuesL)
      analysers[i][1].getByteFrequencyData(valuesR)
      var volume = 1
      var setup = analysers[i][2].context.setup
      if (setup) {
        // include global mixer levels
        volume = setup.overrideVolume() * setup.volume() * (1 - setup.overrideLowPass()) * (1 - setup.overrideHighPass())
      }
      var h = analysers[i][3]
      var lastSel = 0
      for (var x = 0; x < width / 2; x++) {
        var sel = Math.floor(Math.pow(x, spread))
        var lL = average(valuesL, lastSel, sel) / 256
        var lR = average(valuesR, lastSel, sel) / 256
        var mult = (0.5 + (sel / valuesL.length) * 2) * volume
        lastSel = sel

        set(layerL, (width / 2) - x - 1, hslToRgb(h + (0.002 * x), 1, lL * mult))
        set(layerR, (width / 2) + x, hslToRgb(h + (0.002 * x), 1, lR * mult))
      }

      overlay(state.data, layerL.data)
      overlay(state.data, layerR.data)
    }

    sendToLEDs(state)
  }

  var ticker = setInterval(tick, 1000 / 100)

  obs.destroy = function () {
    sendToLEDs.close()
    clearInterval(ticker)
  }

  return obs
}

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
  return sum / count
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
  analyser.smoothingTimeConstant = 0.1
  analyser.minDecibels = -70
  analyser.maxDecibels = 0
  analyser.fftSize = 2048
  splitter.connect(analyser, channel)
  return analyser
}

function getOutputChunks (nodes) {
  var result = []
  nodes.forEach(function (chunk) {
    var node = chunk.node || chunk
    var output = node.context.output
    var routes = chunk().routes
    if (output && routes && routes.output === '$default') {
      result.push(chunk)
    }
  })
  return result
}

function hslToRgb (h, s, l) {
  var r, g, b
  if (s === 0) {
    r = g = b = l // achromatic
  } else {
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s
    var p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function hue2rgb (p, q, t) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}
