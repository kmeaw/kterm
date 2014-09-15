var pty = require('pty.js');
var VT = require('./vt');
var Feed = require('./feed');
var vt = new VT(80,35);
var term = pty.spawn('htop', [], {
  name: 'screen',
  cols: vt.w,
  rows: vt.h,
  env: process.env
});

var feed = new Feed(vt);

var buffer = "";

term.on('data', function(data) {
  buffer = buffer + data;
});

var colors = [
 'black',
  'red',
   'green',
    'brown',
     'blue',
      'magenta',
       'cyan',
        'white' ];


setTimeout(function() { term.write("q\n") }, 2000);
term.on('exit', function() {
  console.log("Processing...");
  buffer.split("").forEach(function(ch) {
    feed.process(ch);
  });
  console.log("VT output:");
  for(var y = 0; y < vt.h; y++)
  {
    for(var x = 0; x < vt.w; x++)
    {
      var attr = vt.abuffer[x + y * vt.w];
      if (attr && attr.bold)
        process.stdout.write("\u001b[1m");
      if (attr && attr.fg && ~colors.indexOf(attr.fg))
        process.stdout.write("\u001b[3" + colors.indexOf(attr.fg) + "m");
      if (attr && attr.bg && ~colors.indexOf(attr.bg))
        process.stdout.write("\u001b[4" + colors.indexOf(attr.bg) + "m");
      process.stdout.write(vt.buffer[x + y * vt.w] || ' ');
      process.stdout.write("\u001b[22;0m");
    }
    process.stdout.write("\n");
  }
  for(var y = 0; y < vt.h; y++)
    console.log(vt.buffer.slice(y * vt.w, y * vt.w + vt.w).map(function(x) { return x ? x : ' '; }).join(''));
});

