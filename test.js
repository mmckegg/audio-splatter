var connect = require('./lib/ftdi-spi')
var getFrame = require('./lib/pixels-apa102')
var NdArray = require('ndarray')

connect(0, function (err, send) {
  if (err) throw err

  var lastStrand = null
  var frame = 0

  setInterval(function () {
    frame += 1

    var strand = Strand(60)

    var r = Math.round(Math.random() * ((frame * 4) % 256))
    var g = Math.round(0)
    var b = Math.round(0)

    strand.set(0, 0, r)
    strand.set(0, 1, g)
    strand.set(0, 2, b)

    if (lastStrand) {
      for (var i = 1; i < strand.shape[0]; i++) {
        strand.set(i, 0, lastStrand.get(i - 1, 0))
        strand.set(i, 1, lastStrand.get(i - 1, 1))
        strand.set(i, 2, lastStrand.get(i - 1, 2))
      }
    }
    lastStrand = strand
    send(getFrame(strand))
  }, 1000 / 60)
})

function Strand (length) {
  return NdArray(new Uint8Array(length * 3), [length, 3])
}
