// Engraves the interactive charts a post brings with it (Chart.js): series
// are told apart by ink tone and the one blue, never by hue; bars are square
// and outlined; hatching keeps the post's meaning (a timed-out run). Every
// colour is read from the theme tokens on each update, so a theme flip, which
// makes the post redraw, re-engraves the charts too.
(function () {
  if (!window.Chart) return;
  var root = document.documentElement;
  var TEXT = '"EB Garamond", Garamond, Georgia, serif';
  var MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

  function tok(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function rgba(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { var n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
    m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return [0, 0, 0, 1];
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  // A tint: `amount` of colour a laid over colour b, as an opaque rgb().
  function tint(a, b, amount) {
    var x = rgba(a), y = rgba(b);
    return "rgb(" + [0, 1, 2].map(function (i) { return Math.round(x[i] * amount + y[i] * (1 - amount)); }).join(",") + ")";
  }

  function palette() {
    var paper = tok("--paper"), ink = tok("--ink"), blue = tok("--accent");
    var series = {
      v09: { fill: blue, edge: blue, line: blue },
      bc: { fill: tint(blue, paper, 0.42), edge: blue, line: blue },
      mar: { fill: ink, edge: ink, line: ink },
      boa: { fill: tint(ink, paper, 0.2), edge: ink, line: ink },
      node: { fill: tint(ink, paper, 0.55), edge: ink, line: ink },
      e262: { fill: paper, edge: ink, line: ink }
    };
    return {
      paper: paper, ink: ink, ink2: tok("--ink-2"), ink3: tok("--ink-3"),
      rule: tok("--rule"), hair: tok("--hair"), series: series
    };
  }

  // The post's own neutrals, translated to the plate's.
  var NEUTRALS = {
    "#2d2a24": "--ink", "#e8e6e3": "--ink",
    "#6b6860": "--ink-2", "#9a9590": "--ink-2",
    "#e8e4dc": "--hair", "#2c2c2a": "--hair",
    "#d4cfc4": "--rule", "#4a4744": "--rule",
    "#faf7f2": "--paper", "#1a1918": "--paper"
  };
  function neutral(v) {
    var t = typeof v === "string" && NEUTRALS[v.toLowerCase()];
    return t ? tok(t) : v;
  }

  function keyOf(name) {
    var n = String(name || "");
    if (/bytecode/i.test(n)) return "bc";
    if (/march/i.test(n)) return "mar";
    if (/^boa/i.test(n)) return "boa";
    if (/^node/i.test(n)) return "node";
    if (/engine262/i.test(n)) return "e262";
    if (/^jsse/i.test(n)) return "v09";
    return null;
  }

  function hatch(s, paper) {
    var c = document.createElement("canvas");
    c.width = c.height = 6;
    var g = c.getContext("2d");
    g.fillStyle = paper;
    g.fillRect(0, 0, 6, 6);
    g.strokeStyle = s.line;
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(0, 6); g.lineTo(6, 0);
    g.moveTo(-1, 1); g.lineTo(1, -1);
    g.moveTo(5, 7); g.lineTo(7, 5);
    g.stroke();
    return g.createPattern(c, "repeat");
  }

  function engraveData(chart, P) {
    var sets = chart.data.datasets || [];
    var perBar = sets.length === 1 && (chart.data.labels || []).some(function (l) { return keyOf(l); });
    sets.forEach(function (ds) {
      var bg = ds.backgroundColor;
      var styleAt = function (k, v) {
        var s = P.series[k];
        if (!s) return v;
        return typeof v === "string" || v === undefined ? s.fill : hatch(s, P.paper);
      };
      if (perBar) {
        var keys = chart.data.labels.map(keyOf);
        ds.backgroundColor = keys.map(function (k, i) { return styleAt(k, Array.isArray(bg) ? bg[i] : bg); });
        ds.borderColor = keys.map(function (k) { return (P.series[k] || {}).edge || P.ink; });
      } else {
        var k = keyOf(ds.label);
        ds.backgroundColor = Array.isArray(bg) ? bg.map(function (v) { return styleAt(k, v); }) : styleAt(k, bg);
        ds.borderColor = (P.series[k] || {}).edge || P.ink;
      }
      ds.hoverBackgroundColor = ds.backgroundColor;
      ds.borderWidth = 1;
      ds.borderRadius = 0;
      ds.borderSkipped = false;
    });
  }

  function engraveOptions(chart, P) {
    var o = chart.options;
    var valueAxis = o.indexAxis === "y" ? "x" : "y";
    Object.keys(o.scales || {}).forEach(function (id) {
      var s = o.scales[id];
      var ticks = s.ticks || {};
      if (ticks.__size === undefined) ticks.__size = (ticks.font && ticks.font.size) || 12;
      s.ticks = Object.assign(ticks, {
        color: P.ink2,
        font: id === valueAxis ? { family: MONO, size: 10.5 } : { family: TEXT, size: Math.max(12, ticks.__size + 1) },
        maxRotation: 0
      });
      var grid = s.grid || {};
      var g = grid.__post || grid.color;
      grid.__post = g;
      // A grid line the post emphasises (the 1x line) stays darker.
      grid.color = typeof g === "function"
        ? function (c) { var v = g(c); return v && rgba(neutral(v)).join() === rgba(P.ink2).join() ? P.ink3 : P.hair; }
        : P.hair;
      s.grid = grid;
      s.border = { color: P.rule };
      if (s.title) Object.assign(s.title, { color: P.ink2, font: { family: TEXT, size: 13, style: "italic" } });
    });
    var t = o.plugins && o.plugins.tooltip;
    if (t) Object.assign(t, {
      backgroundColor: P.paper, titleColor: P.ink, bodyColor: P.ink2, borderColor: P.rule,
      borderWidth: 1, cornerRadius: 0, caretSize: 5, padding: 9,
      titleFont: { family: TEXT, size: 14, weight: "600" }, bodyFont: { family: TEXT, size: 13 },
      boxWidth: 10, boxHeight: 10, boxPadding: 4, usePointStyle: false
    });
  }

  // The post letters its bar values straight onto the canvas in a system
  // face and its own ink; each chart's context is given the plate's.
  var fontProp = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "font");
  var fillProp = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "fillStyle");
  function engraveCtx(ctx) {
    if (!ctx || ctx.__plate) return;
    ctx.__plate = true;
    if (fontProp) Object.defineProperty(ctx, "font", {
      configurable: true,
      get: function () { return fontProp.get.call(this); },
      set: function (v) { fontProp.set.call(this, String(v).replace(/(\d+)px system-ui, sans-serif/, function (m, px) { return (+px + 1) + "px " + TEXT; })); }
    });
    if (fillProp) Object.defineProperty(ctx, "fillStyle", {
      configurable: true,
      get: function () { return fillProp.get.call(this); },
      set: function (v) { fillProp.set.call(this, neutral(v)); }
    });
  }

  function engrave(chart) {
    if (chart.__plate) return;
    chart.__plate = true;
    engraveCtx(chart.ctx);
    var update = chart.update;
    chart.update = function () {
      try {
        var P = palette();
        engraveData(this, P);
        engraveOptions(this, P);
      } catch (e) {}
      return update.apply(this, arguments);
    };
    chart.update();
  }

  function all() {
    try {
      Chart.defaults.font.family = TEXT;
      Chart.defaults.font.size = 13;
      Object.values(Chart.instances || {}).forEach(function (c) {
        if (c.__plate) c.update(); else engrave(c);
      });
    } catch (e) {}
  }
  all();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
})();
