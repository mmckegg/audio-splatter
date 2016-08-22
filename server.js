var connect = require('./lib/ftdi-spi')
var listen = require('./lib/server')
var getFrame = require('./lib/pixels-apa102')

var send = connect(0)
listen(1337, pixels => send(getFrame(pixels)))
