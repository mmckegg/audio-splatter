var getFrame = require('./lib/pixels-apa102')
var connect = require('./lib/ftdi-spi')
var hslToRgb = require('./lib/hsl-to-rgb')
var NdArray = require('ndarray')
var listen = require('./lib/server')
var workerTimer = require('worker-timer')
var Value = require('@mmckegg/mutant/value')
var Struct = require('@mmckegg/mutant/struct')
var h = require('@mmckegg/mutant/html-element')
var watch = require('@mmckegg/mutant/watch')

var stripLength = (60 * 6)
var rate = 100 // fps
var smoothing = 0.8
var minDecibels = -70
var maxDecibels = -5
var channel = 0

var params = {
  hueCycleSpeed: LinkedValue(0.1), // -360 to 360
  hueOffset: LinkedValue(0.1),
  hueOffsetLR: LinkedValue(0),
  spread: LinkedValue(1.1),
  brightness: LinkedValue(0.8),
  saturation: LinkedValue(0.9),
  offset: LinkedValue(0),
  offsetSpeed: LinkedValue(0),
  smoothing: LinkedValue(0)
}

window.params = params

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

var bassMeter = h('meter', { min: 0, max: 1, style: {width: '400px', 'margin-right': '3px'} })
var trebbleMeter = h('meter', { min: 0, max: 1, style: {width: '400px'} })

document.body.appendChild(container)
document.body.appendChild(h('div', {
  style: {
    position: 'relative'
  }
}, [
  h('div', {style: {width: '100%'}}, [
    bassMeter, trebbleMeter
  ]),
  h('div', {
    style: {
      color: 'white',
      display: 'flex',
      'flex-wrap': 'wrap'
    }
  }, [
    LinkedSliders(params.hueCycleSpeed, { title: 'Hue Cycle Speed', max: 5 }),
    LinkedSliders(params.hueOffset, { title: 'Hue Offset', max: 2 }),
    LinkedSliders(params.hueOffsetLR, { title: 'Hue Offset LR', max: 360 }),
    LinkedSliders(params.spread, { title: 'Spread', max: 1.5 }),
    LinkedSliders(params.brightness, { title: 'Brightness', max: 2 }),
    LinkedSliders(params.saturation, { title: 'Saturation', max: 1 }),
    LinkedSliders(params.offset, { title: 'Center Offset', max: stripLength }),
    LinkedSliders(params.offsetSpeed, { title: 'Center Offset Speed', max: 2 }),
    LinkedSliders(params.smoothing, { title: 'Smoothing', max: 1 })
  ])
]))

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
  analysers.push([channels[0], channels[1], 0, 0])
})

var valuesL = new Uint8Array(4096)
var valuesR = new Uint8Array(4096)
var layerL = Strand(stripLength)
var layerR = Strand(stripLength)
var state = Strand(stripLength)

var t = 0

function tick () {
  if (lastMessageAt > Date.now() - 100) {
    // overriding
    return
  }

  t += 1

  for (var i = 0; i < analysers.length; i++) {


    analysers[i][0].getByteFrequencyData(valuesL)
    analysers[i][1].getByteFrequencyData(valuesR)

    var bassValue = Math.min(120, average(valuesL, 0, 8)) / 120
    var trebbleValue = Math.min(20, average(valuesL, 70, 1000)) / 20

    blackout(state, params.smoothing.getValue(bassValue, trebbleValue))

    bassMeter.value = bassValue
    trebbleMeter.value = trebbleValue

    analysers[i][2] = mod(analysers[i][2] + (params.hueCycleSpeed.getValue(bassValue, trebbleValue)), 360)
    analysers[i][3] = analysers[i][3] + (params.offsetSpeed.getValue(bassValue, trebbleValue))

    var baseHue = analysers[i][2] / 360
    var xOffset = Math.round(analysers[i][3] + params.offset.getValue(bassValue, trebbleValue))

    var brightness = params.brightness.getValue(bassValue, trebbleValue)
    var saturation = Math.min(0.9, params.saturation.getValue(bassValue, trebbleValue))
    var spread = Math.max(0, Math.min(params.spread.getValue(bassValue, trebbleValue), 1.5)) || 1
    var hueOffset = params.hueOffset.getValue(bassValue, trebbleValue) / 360
    var hueOffsetLR = params.hueOffsetLR.getValue(bassValue, trebbleValue) / 360

    // hue cycle speed
    // hue cycle mode
    // hue x offset
    // hue LR offset

    // bass layer
    // trebble layer

    var lastSel = 0
    for (var x = 0; x < stripLength / 2; x++) {
      var sel = Math.floor(Math.pow(x, spread))
      var lL = average(valuesL, lastSel, sel) / 256
      var lR = average(valuesR, lastSel, sel) / 256
      var mult = (brightness + (sel / valuesL.length))
      set(layerL, (stripLength / 2) - x, hslToRgb(baseHue + (hueOffset * x), saturation, lL * mult))
      set(layerR, (stripLength / 2) + x, hslToRgb(baseHue + hueOffsetLR + (hueOffset * x), saturation, lR * mult))
      lastSel = sel
    }

    overlay(state, layerL, xOffset)
    overlay(state, layerR, xOffset)
  }

  send(getFrame(state))
  preview(state)
}

workerTimer.setInterval(tick, 1000 / rate)

function overlay (target, arr, offset) {
  for (var i = 0; i < target.shape[0]; i++) {
    var iOffset = mod(i + offset, target.shape[0])
    target.set(iOffset, 0, Math.min(target.get(iOffset, 0) + arr.get(i, 0), 255))
    target.set(iOffset, 1, Math.min(target.get(iOffset, 1) + arr.get(i, 1), 255))
    target.set(iOffset, 2, Math.min(target.get(iOffset, 2) + arr.get(i, 2), 255))
  }
}

function blackout (target, smoothing) {
  smoothing = Math.max(0, Math.min(0.99, Math.pow(smoothing, 1 / 4)))
  for (var i = 0; i < target.shape[0]; i++) {
    target.set(i, 0, target.get(i, 0) * smoothing)
    target.set(i, 1, target.get(i, 1) * smoothing)
    target.set(i, 2, target.get(i, 2) * smoothing)
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

function mod (n, m) {
  return ((n % m) + m) % m
}

function LinkedValue (value) {
  var res = Struct({
    value: Value(value),
    bassInfluence: Value(0),
    trebbleInfluence: Value(0)
  })

  res.getValue = function (bassMultiplier, trebbleMultipler) {
    return res.value() + (bassMultiplier * Math.pow(res.bassInfluence(), 3)) + (trebbleMultipler * Math.pow(res.trebbleInfluence(), 3))
  }

  return res
}

function LinkedSliders (obs, opts) {
  return h('div', {}, [
    h('strong', opts.title), h('br'),
    h('input', {
      type: 'range',
      min: 0,
      step: 0.01,
      max: opts.max,
      hooks: [
        ValueHook(obs.value)
      ]
    }),
    h('input', {
      type: 'range',
      min: -opts.max,
      step: 0.01,
      max: opts.max,
      hooks: [
        ValueHook(obs.bassInfluence)
      ]
    }),
    h('input', {
      type: 'range',
      min: -opts.max,
      step: 0.01,
      max: opts.max,
      hooks: [
        ValueHook(obs.trebbleInfluence)
      ]
    })
  ])
}

function ValueHook (obs) {
  var defaultValue = obs()
  return function (element) {
    element.oninput = function () {
      obs.set(parseFloat(element.value))
    }
    element.ondblclick = function () {
      element.value = defaultValue
    }
    return watch(obs, function (value) {
      element.value = value
    })
  }
}
