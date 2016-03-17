var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Window = require('./window');

var cols = 80, rows = 24;
Error.stackTraceLimit = Infinity;
app.use(express.static(__dirname + '/public'));

var windows = {};

process.env.KTY = module.id;

io.on('connection', function(socket){
  doUpdate();
  socket.on('data', function(key, data) {
    if (key in windows)
      windows[key].pty.write(data);
  });
  socket.on('set title', function(key, data) {
    if (key in window)
      windows[key].title = data;
  });
  socket.on('set ds', function(key, data) {
    if (key in window)
      windows[key].ds = data;
  });
  socket.on('resize', function(width, height) {
    cols = width;
    rows = height;
    for(var k in windows)
    {
      try {
        windows[k].pty.resize(width, height);
      } catch(e) {
        windows[k].pty.emit('exit');
      }
    }
  });
  socket.on('request new', function() {
    doCreate();
    doUpdate();
  });
});

function doUpdate()
{
  io.emit("sync", {windows: Object.keys(windows).map(function(wk) {
    return windows[wk].serialize();
  })});
}

function doCreate()
{
  var window = new Window(cols, rows);

  var idx = 0;
  while (idx in windows)
    idx++;

  window.pty.on('data', function(data) {
    io.emit('data', idx, data);
  });

  window.pty.on('exit', function() {
    delete windows[idx];
    if (Object.keys(windows).length === 0)
      doCreate();
    doUpdate();
  });

  windows[idx] = window;
  active = idx;

  return idx;
}

doCreate();

process.once("SIGINT", function() {
  for(var k in windows)
    windows[k].pty.kill();
  io.eio.close();
  http.close();
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
