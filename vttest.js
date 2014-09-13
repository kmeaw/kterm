var pty = require('pty.js');
var VT = require('./vt');
var Feed = require('./feed');
var term = pty.spawn('q', [], {
  name: 'screen',
  cols: 80,
  rows: 25,
  cwd: process.env.HOME,
  env: process.env
});

var vt = new VT(80,25);
var feed = new Feed(vt);

var buffer = "";

term.on('data', function(data) {
  buffer = buffer + data;
});

term.on('exit', function() {
  console.log("Processing...");
  buffer.split("").forEach(function(ch) {
    feed.process(ch);
  });
  console.log("VT output:");
  for(var y = 0; y < vt.h; y++)
    console.log(vt.buffer.slice(y * vt.w, y * vt.w + vt.w).join(''));
});

