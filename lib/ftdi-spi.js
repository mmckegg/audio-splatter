var ftdi = require('ftdi')

module.exports = function (index, cb) {
  var initialized = false
  var device = new ftdi.FtdiDevice(index);

  device.on('error', function (err) {
    cb(err)
  })

  device.open({
    baudrate: 115200,
    databits: 8,
    stopbits: 1,
    parity: 'none',
    bitmode: 'mpsse'
  }, function (err) {
    if (err) return cb && cb(err)

    // set up IO
    device.write([
      0x85, // disable loopback
      0x80, // Command to set directions of lower 8 pins and force value on bits set as output
      0b00000000, // All low
      0b00001011  // D0, D1, D3 outputs
    ])

    // set up clock
    device.write([
      0x8A, // 60 Mhz base clock
      0x8D, // disable 3 phase clock
      0x97, // disable adaptive clocking
      0x86, // Command to set clock divisor
      0x02, 0x00  // LH clock divisor = 10 Mhz
    ])

    initialized = true

    while (queue.length) {
      // write queue
      write.apply(this, queue.shift())
    }

    cb && cb(null, send)
  })

  function write (data, cb) {
    var pos = 0
    next()
    function next (err) {
      if (err) return cb && cb(err)
      if (pos < data.length) {
        var length = Math.min(512, data.length - pos)
        var chunk = new Buffer(length + 3)
        chunk[0] = 0x11
        chunk[1] = getL(length - 1)
        chunk[2] = getH(length - 1)
        data.copy(chunk, 3, pos, pos + length)
        device.write(chunk, next)
        pos += 512
      } else {
        cb && cb()
      }
    }
  }

  var queue = []

  var send = function (data, cb) {
    if (initialized) {
      write(data, cb)
    } else {
      //queue.push([data, cb])
    }
  }

  send.close = function () {
    device.close()
  }

  return send
}

function getL (value) {
  return value & 0xFF
}

function getH (value) {
  return value >> 8
}
