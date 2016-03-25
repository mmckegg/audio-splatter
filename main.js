var app = require('app')
var BrowserWindow = require('browser-window')
var mainWindow = null

app.on('window-all-closed', function () {
  app.quit()
})

app.on('ready', function () {
  mainWindow = new BrowserWindow({
    webPreferences: {
      experimentalFeatures: true,
      pageVisibility: true
    }
  })
  mainWindow.loadURL('file://' + __dirname + '/realtime.html')
  mainWindow.on('closed', function () {
    mainWindow = null
  })
})
