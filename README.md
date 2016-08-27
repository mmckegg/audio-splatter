# audio-splatter

## install

### Debian Linux

install [`node-ftdi`](https://github.com/mmckegg/node-ftdi) using `node_modules/node-ftdi/install.sh` script

blacklist default `ftdi_sio` kernel module

- create file `/etc/modprobe.d/ft232h.conf` with content: `blacklist ftdi_sio`

if using [FT232H](https://www.adafruit.com/product/2264), change per-vendor usb permissions to allow root users:

- create file `/etc/udev/rules.d/ft232h.rules` with content: `SUBSYSTEM=="usb", ATTRS{idVendor}=="0403", MODE:="0666"`
