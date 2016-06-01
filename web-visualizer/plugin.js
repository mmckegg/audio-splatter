var ObservStruct = require('observ-struct')
var Server = require('./server')
var NdArray = require('ndarray')
var hslToRgb = require('../lib/hsl-to-rgb')

module.exports = Visualizer

function Visualizer (context) {
  var obs = ObservStruct({})

  var send = Server(8080)

  var width = 256
  var project = context.project
  var analysers = []

  project.items.forEach(attachTo)
  project.items.onLoad(attachTo)

  var valuesL = new Uint8Array(4096)
  var valuesR = new Uint8Array(4096)
  var layerL = Strand(width)
  var layerR = Strand(width)

  function attachTo (item) {
    if (item.node._type === 'LoopDropSetup') {
      var analysersForChunk = []
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
  }

  function tick () {
    var state = Strand(width)

    for (var i = 0; i < analysers.length; i++) {
      analysers[i][0].getByteFrequencyData(valuesL)
      analysers[i][1].getByteFrequencyData(valuesR)
      var volume = 1
      var setup = analysers[i][2].context.setup
      if (setup && setup.output) {
        // use level from global launch control
        volume = setup.output.gain.value
      }
      var h = analysers[i][3]
      var lastSel = 0

      for (var x = 0; x < width / 2; x++) {
        var sel = Math.floor(Math.pow(x, 1.3))
        var lL = average(valuesL, lastSel, sel) / 256
        var lR = average(valuesR, lastSel, sel) / 256
        var mult = (2 + (sel / valuesL.length) * 2) * volume
        lastSel = sel

        set(layerL, (width / 2) - x - 1, hslToRgb(h + (0.001 * x), 1, lL * lL * mult))
        set(layerR, (width / 2) + x, hslToRgb(h + (0.001 * x), 1, lR * lR * mult))
      }

      overlay(state.data, layerL.data)
      overlay(state.data, layerR.data)
    }

    send(state)
  }

  var ticker = setInterval(tick, 1000 / 60)

  obs.destroy = function () {
    send.close()
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
  analyser.smoothingTimeConstant = 0.5
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
