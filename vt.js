var SETMODE = {
  NORMAL: {
    LNM: 20, // line feed mode
    IRM: 4, // insert mode
  },

  /* DEC private modes: */
  PRIVATE: {
    DECTCEM: 25, // show cursor
    DECSCNM: 5,  // reverse video
    DECOM: 6,    // origin mode
    DECAWM: 7,   // auto-wrap
    DECCOLM: 3,  // 132-column mode
  },
};

// Set graphic renition codes:
var SGR = {
    0: {bold: false, italic: false, underscore: false, reverse: false, strikethrough: false, fg: null, bg: null},
    1: {bold: true},
    2: {italic: true},
    4: {underscore: true},
    7: {reverse: true},
    9: {strikethrough: true},

    22: {bold: false},
    23: {italic: false},
    24: {underscore: false},
    27: {reverse: false},
    29: {strikethrough: false},

    30: {fg: 'black'},
    31: {fg: 'red'},
    32: {fg: 'green'},
    33: {fg: 'brown'},
    34: {fg: 'blue'},
    35: {fg: 'magenta'},
    36: {fg: 'cyan'},
    37: {fg: 'white'},
    39: {fg: null},

    40: {bg: 'black'},
    41: {bg: 'red'},
    42: {bg: 'green'},
    44: {bg: 'brown'},
    44: {bg: 'blue'},
    45: {bg: 'magenta'},
    46: {bg: 'cyan'},
    47: {bg: 'white'},
    49: {bg: null},
};

if (!Array.prototype.fill) {
  // MDN, polyfill
  Array.prototype.fill = function(value) {

    if (this == null) {
      throw new TypeError('this is null or not defined');
    }

    var O = Object(this);

    var len = O.length >>> 0;

    var start = arguments[1];
    var relativeStart = start >> 0;

    var k = relativeStart < 0 ?
      Math.max(len + relativeStart, 0) :
      Math.min(relativeStart, len);

    var end = arguments[2];
    var relativeEnd = end === undefined ?
      len : end >> 0;

    var final = relativeEnd < 0 ?
      Math.max(len + relativeEnd, 0) :
      Math.min(relativeEnd, len);

    while (k < final) {
      O[k] = value;
      k++;
    }

    return O;
  };
}

module.exports = function VT(w,h)
{
  this.w = w;
  this.h = h;

  this.buffer = [];
  this.abuffer = [];
  this.x = 0;
  this.y = 0;
  this.sgr = {};
  this.margins = [];
  this.charset = 0;
  this.tabs = [];
  this.modes = {};

  this.stack = [];

  this.reset();
};

module.exports.prototype.reset = function reset()
{
  this.buffer = new Array(this.w * this.h);
  this.abuffer = new Array(this.w * this.h);
  this.modes = {DECAWM:true, DECTCEM:true}
  this.margins = [0, this.h - 1];
  this.tabs = [];
  for (var x = 7; x < this.w; x += 8)
    this.tabs.push(x);
  this.x = 0;
  this.y = 0;
};

module.exports.prototype.select_graphic_rendition = function set_graphic_rendition()
{
  var sgr = {};
  if (this.sgr.bold) sgr.bold = this.sgr.bold;
  if (this.sgr.italic) sgr.italic = this.sgr.italic;
  if (this.sgr.underscore) sgr.underscore = this.sgr.underscore;
  if (this.sgr.reverse) sgr.reverse = this.sgr.reverse;
  if (this.sgr.strikethrough) sgr.strikethrough = this.sgr.strikethrough;
  if (this.sgr.fg) sgr.fg = this.sgr.fg;
  if (this.sgr.bg) sgr.bg = this.sgr.bg;
  for (var i = 0; i < arguments.length; i++)
  {
    var a = arguments[i];
    if (SGR[a])
    {
      for (var k in SGR[a])
      {
        if (SGR[a][k])
          sgr[k] = SGR[a][k];
        else
          delete sgr[k];
      }
    }
    else
      console.log("Unknown SGR: %d.", a);
  }
  this.sgr = sgr;
};

module.exports.prototype.reset_mode = function set_mode()
{
  var modelist = SETMODE.NORMAL;
  for (var i = 0; i < arguments.length; i++)
  {
    if (arguments[i] == "private")
    {
      modelist = SETMODE.PRIVATE;
      continue;
    }

    for (var m in modelist)
    {
      if (modelist[m] == arguments[i])
        delete this.modes[m];
    }
  }
};

module.exports.prototype.set_mode = function set_mode()
{
  for (var i = 0; i < arguments.length; i++)
    for (var m in SETMODE)
    {
      if (SETMODE[m] == arguments[i])
        this.modes[m] = true;
    }
};

module.exports.prototype.resize = function resize(w,h)
{
  if (w > this.w)
  {
    for (var y = 0; y < this.h; y++)
    {
      Array.prototype.splice.apply (this.buffer,
                                    [this.w + w * y, 0].concat(new Array(w - this.w)));
      Array.prototype.splice.apply (this.abuffer,
                                    [this.w + w * y, 0].concat(new Array(w - this.w)));
    }
    for (var x = parseInt(this.w / 7) * 7 + 7; x < w; w += 8)
      if (this.tabs.indexOf(x) == -1)
        this.tabs.push (x);
  }
  else if (w < this.w)
  {
    for (var y = 0; y < this.h; y++)
    {
      this.buffer.splice (y * w, this.w - w);
      this.abuffer.splice (y * w, this.w - w);
    }
  }
  this.w = w;

  while (h > this.h)
  {
    Array.prototype.splice.apply (this.buffer, 
                                  [this.buffer.length, 0].concat(new Array(this.w)));
    Array.prototype.splice.apply (this.abuffer, 
                                  [this.abuffer.length, 0].concat(new Array(this.w)));
    this.h += 1;
  }
  if (h < this.h)
    Array.prototype.splice (0, this.w * (this.h - h));
  this.h = h;

  this.margins = [0, this.h - 1];
  delete this.modes.DECOM;
};

module.exports.prototype.print = function print(str)
{
  for (var i = 0; i < str.length; i++)
  {

  // Auto-wrap
  if (this.x == this.w)
  {
    if (this.modes.DECAWM)
      this.cr().lf();
    else
      this.x -= 1;
  }

  // Insert mode
  if (this.modes.IRM)
    this.insert();

  this.buffer[this.y * this.w + this.x] = str[i];
  this.abuffer[this.y * this.w + this.x] = this.sgr;

  this.x += 1;

  }
};

module.exports.prototype.cr = function cr()
{
  this.x = 0;
  return this;
};

module.exports.prototype.ind = function down() // Index
{
  if (this.y == this.margins[1])
  {
    this.buffer.splice (this.w * this.margins[0], this.w);
    Array.prototype.splice.apply (this.buffer,
                                  [this.w * this.margins[1], 0].concat(new Array(this.w)));
    this.abuffer.splice (this.w * this.margins[0], this.w);
    Array.prototype.splice.apply (this.abuffer,
                                  [this.w * this.margins[1], 0].concat(new Array(this.w)));
  }
  else
    this.cud(1);

  return this;
};

module.exports.prototype.ri = function up() // Reverse Index
{
  if (this.y == this.margins[0])
  {
    this.buffer.splice (this.w * this.margins[1], this.w);
    Array.prototype.splice.apply (this.buffer,
                                  [this.w * this.margins[0], 0].concat(new Array(this.w)));
    this.abuffer.splice (this.w * this.margins[1], this.w);
    Array.prototype.splice.apply (this.abuffer,
                                  [this.w * this.margins[0], 0].concat(new Array(this.w)));
  }
  else
    this.cup(1);

  return this;
};

module.exports.prototype.erase = function se(n)
{
  if (n === 0)
    n = 1;
  if (n > this.w - this.x)
    n = this.w - this.x;
  Array.prototype.splice.apply (this.buffer,
                                [this.y * this.w + this.x, n].concat(new Array(n)));
  Array.prototype.splice.apply (this.abuffer,
                                [this.y * this.w + this.x, n].concat(new Array(n)));
  this.abuffer.fill (this.sgr, this.y * this.w + this.x, this.y * this.w + this.x + n);
};

module.exports.prototype.shift_ins = function si(n)
{
  if (n === 0)
    n = 1;
  if (n > this.w - this.x)
    n = this.w - this.x;
  Array.prototype.splice.apply (this.buffer,
                                [this.y * this.w + this.x, 0].concat(new Array(n)));
  Array.prototype.splice.apply (this.abuffer,
                                [this.y * this.w + this.x, 0].concat(new Array(n)));
  this.abuffer.fill (this.sgr, this.y * this.w + this.x, this.y * this.w + this.x + n);
  this.buffer.splice (this.y * this.w + this.x + n, n);
  this.abuffer.splice (this.y * this.w + this.x + n, n);
};

module.exports.prototype.shift_del = function sd(n)
{
  if (n === 0)
    n = 1;
  if (n > this.w - this.x)
    n = this.w - this.x;
  var m = this.w - n;

  this.buffer.splice (this.y * this.w + this.x, n);
  this.abuffer.splice (this.y * this.w + this.x, n);
  Array.prototype.splice.apply (this.buffer,
                                [this.y * this.w + this.w - m, 0].concat(new Array(m)));
  Array.prototype.splice.apply (this.abuffer,
                                [this.y * this.w + this.w - m, 0].concat(new Array(m)));
  this.abuffer.fill (this.sgr, this.y * this.w + this.w - m, this.y * this.w + this.w);
};

module.exports.prototype.cud = function cud(n) // Cursor Down
{
  if (n === 0)
    n = 1;
  this.y += n;
  this.decom_fix();
  return this;
};

module.exports.prototype.cuu = function cud(n) // Cursor Up
{
  if (n === 0)
    n = 1;
  this.y -= n;
  this.decom_fix();
  return this;
};

module.exports.prototype.cuf = function cuf(n) // Cursor Forward
{
  if (n === 0)
    n = 1;
  this.x += n;
  this.fix();
  return this;
};

module.exports.prototype.cub = function cub(n) // Cursor Backward
{
  if (n === 0)
    n = 1;
  this.x -= n;
  this.fix();
  return this;
};

module.exports.prototype.lf = function lf()
{
  this.ind();
  if (this.modes.LNM)
    this.cr();
  this.fix();

  return this;
};

module.exports.prototype.range_erase = function(x1,y1,x2,y2)
{
  x1 = x1 || 0;
  y1 = y1 || 0;
  x2 = x2 || (this.w - 1);
  y2 = y2 || (this.h - 1);

  if (x1 < 0) x1 = 0;
  if (y1 < 0) y1 = 0;
  if (x2 >= this.w) x2 = this.w;
  if (y2 >= this.h) y2 = this.h;

  var start = x1 + y1 * this.w;
  var end = x2 + y2 * this.w;

  this.buffer.fill (undefined, start, end + 1);
  this.abuffer.fill (this.sgr, start, end + 1);
};

module.exports.prototype.set_margins = function(t,b)
{
  this.margins = [t, b];
  return this;
};

module.exports.prototype.cup = function cup(y,x) // Cursor Position
{
  x = (x > 1 ? x : 1) - 1;
  y = (y > 1 ? y : 1) - 1;
  if (this.modes.DECOM)
  {
    y += this.margins[0];
    if (y < this.margins[0] || y > this.margins[1])
      return this;
  }
  this.x = x;
  this.y = y;
  this.fix();

  return this;
};

module.exports.prototype.decom_fix = function decom_fix()
{
  var is_decom = this.modes.DECOM;
  this.modes.DECOM = true;
  this.fix();
  this.modes.DECOM = is_decom;
  return this;
};

module.exports.prototype.fix = function fix()
{
  if (this.x >= this.w)
    this.x = this.w - 1;
  if (this.x < 0)
    this.x = 0;

  if (this.modes.DECOM)
  {
    if (this.y >= this.h)
      this.y = this.h - 1;
    if (this.y < 0)
      this.y = 0;
  }
  else
  {
    if (this.y >= this.h)
      this.y = this.h - 1;
    if (this.y < 0)
      this.y = 0;
  }
};

module.exports.prototype.tab = function tab()
{
  for (var i = 0; i < this.tabs.length; i++)
  {
    if (this.x < this.tabs[i])
    {
      this.x = this.tabs[i];
      return this;
    }
  }

  this.x = this.w - 1;
  return this;
};

module.exports.prototype.push = function push()
{
  this.stack.push({
    x: this.x,
    y: this.y,
    modes: this.modes,
  });

  return this;
};

module.exports.prototype.pop = function pop()
{
  var s = this.stack.pop();
  if (s)
  {
    for(var k in s)
    {
      if (s.hasOwnProperty(k))
        this[k] = s[k];
    }

    this.up(0);
  }
  else
  {
    delete this.modes.DECOM;
    this.x = 0;
    this.y = 0;
  }
};

module.exports.prototype.insert = function insert()
{
  if (this.y < this.margins[0] && this.y > this.margins[1])
    return this;

  this.buffer.splice (this.w * this.margins[1], this.w);
  this.abuffer.splice (this.w * this.margins[1], this.w);
  Array.prototype.splice.apply (this.buffer,
                                [this.y * this.w, 0].concat(new Array(this.w)));
  Array.prototype.splice.apply (this.abuffer,
                                [this.y * this.w, 0].concat(new Array(this.w)));
  this.cr();
  return this;
};

module.exports.prototype.remove = function remove()
{
  if (this.y < this.margins[0] && this.y > this.margins[1])
    return this;

  this.buffer.splice (this.w * this.y, this.w);
  this.abuffer.splice (this.w * this.y, this.w);
  Array.prototype.splice.apply (this.buffer,
                                [this.margins[1] * this.w, 0].concat(new Array(this.w)));
  Array.prototype.splice.apply (this.abuffer,
                                [this.margins[1] * this.w, 0].concat(new Array(this.w)));
  this.abuffer.fill (this.sgr, this.margins[1] * this.w, (this.margins[1] + 1) * this.w);
  this.cr();
  return this;
};

module.exports.prototype.add_tab = function add_tab(t)
{
  this.tabs = this.tabs.filter(function(x) { return x <= t; })
      .concat([t])
      .concat(this.tabs.filter(function(x) { return x > t; }));
  return this;
};

module.exports.prototype.remove_tab = function remove_tab(t)
{
  this.tabs = this.tabs.filter(function(x) { return x != t; });
  return this;
};

module.exports.prototype.bell = function bell() {};

module.exports.prototype.align_test = function align_test()
{
  console.log("Alignment test.");
};
