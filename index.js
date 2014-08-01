var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var pty = require('pty.js');
var path = require('path');

var cols = 80, rows = 24;

app.use(express.static(__dirname + '/public'));

var terms = {};
var termmap = [];
var ds = {};
var titles = {};

process.env.KTY = module.id;

io.on('connection', function(socket){
  doUpdate();
  socket.on('data', function(key, data) {
    if (key in terms)
      terms[key].write(data);
  });
  socket.on('set title', function(key, data) {
    titles[key] = data;
  });
  socket.on('set ds', function(key, data) {
    ds[key] = data;
  });
  socket.on('resize', function(width, height) {
    cols = width;
    rows = height;
    for(var k in terms)
    {
      try {
        terms[k].resize(width, height);
      } catch(e) {
        terms[k].emit('exit');
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
  io.emit("sync", {termmap:termmap, ds:ds, titles:titles});
}

function doCreate()
{
  var term = pty.spawn(process.env.SHELL || 'bash', [], {
    name: 'xterm-color',
    cols: cols,
    rows: rows,
    cwd: process.env.HOME,
    env: process.env
  });

  var idx = 0;
  while (idx in terms)
    idx++;

  term.on('data', function(data) {
    io.emit('data', idx, data);
  });

  term.on('exit', function() {
    var i = termmap.indexOf(idx);
    termmap.splice(i, 1);
    delete terms[idx];
    delete titles[idx];
    delete ds[idx];
    if (terms.length === 0)
      doCreate();
    doUpdate();
  });

  var i = 0;
  while (i < termmap.length)
    if (termmap[i] > idx)
      break;
    else
      i++;
  termmap.splice(i, 0, idx);
  terms[idx] = term;
  ds[idx] = path.basename(process.env.SHELL || 'bash');
  titles[idx] = ds[idx];
  active = idx;

  return idx;
}

doCreate();

process.once("SIGINT", function() {
  for(var k in terms)
    terms[k].kill();
  io.eio.close();
  http.close();
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
