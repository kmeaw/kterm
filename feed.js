/* States */
var NORMAL = 0,
    ESCAPE = 1,
    MODE = 2,
    DECSHARP = 3,
    IGNORE = 4,
    OSC = 5;

module.exports = function Feed(vt)
{
  this.vt = vt;
  this.initialize();
};

module.exports.prototype.initialize = function initialize()
{
  this.state = NORMAL;
  this.values = [0];
};

module.exports.prototype.process = function process(s)
{
  var ctrl = -1;
  for(var i = 0; i < s.length; i++)
  {
    if (this.state == NORMAL)
    {
      if (ctrl < i)
      {
        ctrl = s.substr(i).search(/[\u0000-\u001f\u007f\u009b]/);
	if (ctrl == -1)
	  ctrl = s.length;
	else
	  ctrl = ctrl + i;
      }
      if (i != ctrl - 1 && ctrl > i)
      {
        this.vt.print(s.substring(i, ctrl));
        i = ctrl - 1;
      }
      else
        this.process_char(s[i]);
    }
    else
      this.process_char(s[i]);
  }
};

module.exports.prototype.osc = function osc(ch)
{
  var code = ch.charCodeAt(0);
  return (code >= 0x20 && code != 0x9C) || (code >= 0x08 && code <= 0x0D);
};

module.exports.prototype.process_char = function process_char(ch)
{
  var prev_state = this.state;
  switch (this.state)
  {
    case NORMAL:
      if (!this.normal(ch))
      {
        switch (ch) /* Special control characters */
        {
          case "\u001b": // <ESC>
            this.state = ESCAPE;
            break;
          case "\u009b": // CSI = <ESC> [
            this.state = MODE;
            this.values = [0];
            break;
          case "\u0000": // <NUL>
          case "\u007f": // <DEL>
            break;
          default:
	    if (ch.charCodeAt(0) >= 32)
            this.vt.print(ch); // .charCodeAt(0) < 32 ? '?' : ch);
        }
      }
      break;
    case ESCAPE:
      if (!this.escape(ch))
        this.initialize();
      break;
    case MODE:
      if (!this.mode(ch))
        this.initialize();
      break;
    case DECSHARP:
      if (ch == '8')
        this.vt.align_test();
      else
        this.initialize();
      this.state = NORMAL;
      break;
    case OSC:
      if (!this.osc(ch))
        this.state = NORMAL;
      break;
    case IGNORE:
      this.state = NORMAL;
      break;
  }
};

module.exports.prototype.normal = function normal(ch)
{
  switch (ch)
  {
    case "\u0007": // BEL
      this.vt.bell();
      break;
    case "\u0008": // BS
      this.vt.cub();
      break;
    case "\u0009": // HT
      this.vt.tab();
      break;
    case "\u000a": // '\n'
    case "\u000b": // VT
    case "\u000c": // FF
      this.vt.lf();
      break;
    case "\u000d": // '\r'
      this.vt.cr();
      break;
    default:
      return false;
  }

  return true;
};

module.exports.prototype.escape = function escape(ch)
{
  switch (ch)
  {
    case "#":
      this.state = DECSHARP;
      break;
    case "]":
      this.state = OSC;
      break;
    case "[":
      this.state = MODE;
      this.values = [0];
      break;
    case "c": // RIS
      this.vt.reset();
      break;
    case "D": // IND
      this.vt.ind();
      break;
    case "E": // NEL
      this.vt.lf();
      break;
    case "H": // HTS
      this.vt.add_tab(this.vt.x);
      break;
    case "M": // RI
      this.vt.ri();
      break;
    case "7": // DECSC
      this.vt.push();
      break;
    case "8": // DECRC
      this.vt.pop();
      break;
    case "\u001b":
      this.state = IGNORE;
      break;
    case "(": // G0
    case ")": // G1
      this.state = IGNORE;
      break;
    default:
      return false;
  }

  return true;
};

module.exports.prototype.mode = function mode(ch)
{
  this.state = NORMAL;
  switch (ch)
  {
    case "0": case "1": case "2": case "3": case "4":
    case "5": case "6": case "7": case "8": case "9":
      this.state = MODE;
      this.values.push(this.values.pop() * 10 + parseInt(ch));
      break;
    case ";":
      this.state = MODE;
      this.values.push(0);
      break;
    case "@": // ICH
      this.vt.shift_ins.apply (this.vt, this.values);
      break;
    case "A": // CUU
      this.vt.cuu.apply (this.vt, this.values);
      break;
    case "B": // CUD
    case "e": // VPR
      this.vt.cud.apply (this.vt, this.values);
      break;
    case "C": // CUF
    case "a": // HPR
      this.vt.cuf.apply (this.vt, this.values);
      break;
    case "D": // CUB
      this.vt.cub.apply (this.vt, this.values);
      break;
    case "E": // CNL (Linux)
      this.vt.cud.apply (this.vt, this.values);
      this.vt.cr();
      break;
    case "F": // CPL (Linux)
      this.vt.cuu.apply (this.vt, this.values);
      this.vt.cr();
      break;
    case "G": // CHA
      this.vt.x = (this.values.pop() || 1) - 1;
      this.vt.fix();
      break;
    case "H": // CUP
    case "f": // HVP
      this.vt.cup.apply (this.vt, this.values);
      break;
    case "J": // ED
      switch (this.values.pop() || 0)
      {
        case 0: // from cursor to end
          this.vt.range_erase(this.vt.x, this.vt.y);
          break;
        case 1: // from start to cursor
          this.vt.range_erase(0, 0, this.vt.x, this.vt.y);
          break;
        case 2: // all
          this.vt.range_erase();
          break;
      }
      break;
    case "K": // EL
      switch (this.values.pop() || 0)
      {
        case 0: // from cursor to end
          this.vt.range_erase(this.vt.x, this.vt.y, this.vt.w - 1, this.vt.y);
          break;
        case 1: // from start to cursor
          this.vt.range_erase(0, this.vt.y, this.vt.x, this.vt.y);
          break;
        case 2: // entire line
          this.vt.range_erase(0, this.vt.y, this.vt.w - 1, this.vt.y);
          break;
      }
      break;
    case "L": // IL
      var n = this.values.pop() || 1;
      while (n--)
        this.vt.insert();
      break;
    case "M": // DL
      var n = this.values.pop() || 1;
      while (n--)
        this.vt.remove();
      break;
    case "P": // DCH
      this.vt.shift_del.apply (this.vt, this.values);
      break;
    case "X": // ECH
      this.vt.erase.apply (this.vt, this.values);
      break;
    case "d": // VPA
      this.vt.cup (this.values.pop() || 1, this.x);
      break;
    case "g": // TBC
      if (this.values.pop() == 3)
        this.vt.tabs = [];
      else
        this.vt.remove_tab(this.vt.x);
      break;
    case "h": // SM
      this.vt.set_mode.apply (this.vt, this.values);
      break;
    case "l": // RM
      this.vt.reset_mode.apply (this.vt, this.values);
      break;
    case "m": // SGR
      if (this.values.length === 0)
        this.values.push(0);
      this.vt.select_graphic_rendition.apply (this.vt, this.values);
      break;
    case "r": // DECSTBM
      this.vt.set_margins (this.values[0] || 0, this.values[1] || (this.vt.h - 1));
      break;
    case "'": // HPA
      this.vt.x = (this.values.pop() || 1) - 1;
      this.vt.fix();
      break;
    case " ": // <space>
      this.state = MODE;
      break;
    case "?": // private flag
      this.state = MODE;
      this.values.push("private");
      break;
    case "\u0018": // CAN
    case "\u0019": // SUB
      return this.normal(ch);
    default:
      if (!this.normal(ch))
        return false;
      break;
  }

  return true;
};
