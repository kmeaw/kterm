var pty = require('pty.js');
var path = require('path');
var VT = require('./vt');
var Feed = require('./feed');
module.exports = function Window(w, h) {
  this.pty = pty.spawn(process.env.SHELL || 'bash', [], {
    name: 'screen',
    cols: w,
    rows: h,
    cwd: process.env.HOME,
    env: process.env
  });
  this.ds = path.basename(process.env.SHELL || 'bash');
  this.title = this.ds;
};
module.exports.prototype.serialize = function() {
  return {ds: this.ds, title: this.title};
};
