var terms = {};
var termmap = [];
var active = null;
var prev = null;
var titles = {};
var ds = {};
var activate = true;

var rows = 24;
var cols = 80;

jQuery(function($) {
  socket = io.connect();
  socket.on("connect", function() {
    socket.on("sync", function(options) {
      for(var k in terms)
        if (options.termmap.indexOf(parseInt(k)) == -1)
	  doStop(k);
      options.termmap.forEach(function(k) {
        if (!(k in terms))
	{
	  doStart(k);
	  if (activate)
	  {
	    activate = false;
	    doSet(k);
	  }
	}
      });
      termmap = options.termmap;
      ds = options.ds;
      titles = options.titles;
      if (active === null || !(active in terms))
        doSet(termmap[0]);
      updateBar();
    });
    var charwidth = 8;
    var charheight = 16;
    var $bar = $(".bar");
    function updateBar()
    {
      $bar.empty();
      var $ol = $("<ol />");
      $bar.append($ol);
      termmap.forEach(function(k) {
        var t = ds[k];
	var $li = $("<li />").text(t).attr("value", k);
	$li.click(function() {
	  doSet(k);
	});
	if (k == active)
	  $li.addClass("active");
	else if (k == prev)
	  $li.addClass("prev");
	$ol.append($li);
      });
    }
    function doResize()
    {
      var newwidth = parseInt($(".wrap").width() / charwidth), 
          newheight = parseInt($(".wrap").height() / charheight);
      if (newwidth < 80) newwidth = 80;
      if (newheight < 24) newheight = 24;
      for (var k in terms)
	terms[k].resize(newwidth, newheight);
      cols = newwidth; rows = newheight;
      socket.emit("resize", newwidth, newheight);
    }
    function doStart(key)
    {
      console.log("Starting terminal %s", key);
      var term = new Terminal({
	cols: cols,
	rows: rows,
	screenKeys: true,
	useStyle: true,
	cursorBlink: false,
	debug: true
      });
      term.on("data", function(data) {
	socket.emit("data", key, data);
      });
      term.on("request create", function() {
	activate = true;
	socket.emit("request new");
      });
      term.on("request term", function(key) {
        if (key in terms)
	  doSet(key);
      });
      term.on("request term previous", function() {
	var idx = termmap.indexOf(active);
	doSet(termmap[(termmap.length + idx - 1) % termmap.length]);
      });
      term.on("request term next", function() {
	var idx = termmap.indexOf(active);
	doSet(termmap[(idx + 1) % termmap.length]);
      });
      term.on("request term switch", function() {
        if (prev !== null)
	  doSet(prev);
      });
      term.on("title", function(title) {
	socket.emit("set title", key, title);
	titles[key] = title;
	updateBar();
      });
      term.on("ds", function(dsi) {
        socket.emit("set ds", key, dsi);
	ds[key] = dsi;
	updateBar();
      });
      var $e = $("<div />").attr("id", "t" + key).addClass("term").hide();
      $(".wrap").append($e);
      term.open($e.get(0));
      terms[key] = term;
      if (active === null)
        doSet(key);
    }
    function doStop(key)
    {
      console.log("Stopping terminal %s", key);
      var term = terms[key];
      if (!term) return;
      var $e = $("#t" + key);
      term.destroy();
      $e.remove();
      delete terms[key];
      delete titles[key];
      delete ds[key];
    }
    function doSet(key)
    {
      if (!(key in terms))
        return;
      if (active !== prev)
        prev = active;
      $(".wrap > div.term").hide();
      $("#t" + key).show();
      terms[key].focus();
      active = key;
      updateBar();
    }
    $(window).on("resize", doResize);
    setTimeout(doResize, 1000);
    setInterval(function() {
      if (active && terms[active])
        terms[active].focus();
    }, 5000);
    socket.on("data", function(key, data) {
      if (terms[key])
	terms[key].write(data);
    });
    socket.on("disconnect", function() {
      $(".terminal").hide();
    });
  });
});
