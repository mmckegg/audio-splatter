// FROM: https://github.com/livejs/pixels-apa102/blob/master/index.js
// modified to add hacky gamma correction and dynamic range
// will PR when not quite so hacky.

var cwise = require('cwise')

var pixelsToApa102Buffer = cwise({
  args: ['shape', 'index', { blockIndices: -1 }],
  pre: function (shape) {
    var length = shape.slice(0, shape - 1).reduce(function (a, b) { return a * b })
    var numEndBytes = Math.ceil((length - 1) / 16)
    this.buffer = Buffer((length + 1) * 4 + numEndBytes)
    // start frame
    Buffer([0x00, 0x00, 0x00, 0x00])
      .copy(this.buffer, 0)
  },
  body: function (shape, index, pixel) {
    // LED startframe is three "1" bits, followed by 5 brightness bits
    // https://github.com/tinue/APA102_Pi/blob/master/apa102.py#L56
    // or
    // https://github.com/pololu/apa102-arduino/blob/30d336dacec08d2f16f654f236a2a7044e6d2168/APA102.h#L123-L132
    // TODO implement per-pixel brightness
    // - https://github.com/FastLED/FastLED/issues/91
    // - https://github.com/pololu/apa102-arduino/commit/9a77cdeaddfc3eb2c7bb7b2d91a22f16a2120773
    // - http://stackoverflow.com/questions/596216/formula-to-determine-brightness-of-rgb-color#596243
    // 0b11100000 = 0340 = 0xE0 = 224
    var red = pixel[0]
    var green = pixel[1]
    var blue = pixel[2]
    var gamma = 2
    var lum = (0.33 * red + 0.5 * green + 0.16 * blue)
    var brightness = Math.min(31, Math.max(1, Math.ceil(Math.pow(lum / 256, 1.5) * 31)))
    var prefix = brightness | 0xE0
    Buffer([
      prefix,
      Math.ceil(Math.pow(blue / 256, gamma) * 256),
      Math.ceil(Math.pow(green / 256, gamma) * 256),
      Math.ceil(Math.pow(red / 256, gamma) * 256)
    ]).copy(this.buffer, (index[0] + 1) * 4)
  },
  post: function (shape) {
    // round up numLEDs/2 bits (or numLEDs/16 bytes)
    // https://github.com/tinue/APA102_Pi/blob/master/apa102.py#L94
    //
    // https://www.pololu.com/product/2554
    // https://a.pololu-files.com/picture/0J6578.600.jpg?43cdc8b658def752351be635ab28978e
    // https://github.com/pololu/apa102-arduino/blob/30d336dacec08d2f16f654f236a2a7044e6d2168/APA102.h#L82-L121
    var length = shape.slice(0, shape - 1).reduce(function (a, b) { return a * b })
    var numEndBytes = Math.ceil((length - 1) / 16)
    // end frames
    for (var i = 0; i < numEndBytes; i++) {
      Buffer([0x00])
        .copy(this.buffer, (length + 1) * 4 + i)
    }
    return this.buffer
  },
  funcName: 'pixelsToApa102Buffer'
})

module.exports = pixelsToApa102Buffer
