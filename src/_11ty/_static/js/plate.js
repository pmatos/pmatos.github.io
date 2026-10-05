// Zone references for the index of sections: each section letter is read
// against the plate border (rows A-F down the side, columns 1-8 across), as
// on a drawing. Without this script the index still lists every section.
(function () {
  var plate = document.querySelector(".plate");
  if (!plate) return;
  var ROWS = "ABCDEF";

  function zones() {
    var zoneBar = plate.querySelector(".zones");
    var visible = zoneBar && getComputedStyle(zoneBar).display !== "none";
    var box = plate.getBoundingClientRect();
    document.querySelectorAll(".soi-z").forEach(function (el) {
      var target = document.getElementById(el.getAttribute("data-for"));
      if (!visible || !target) { el.textContent = ""; return; }
      var t = (target.querySelector(".sec-t") || target).getBoundingClientRect();
      var row = Math.min(5, Math.max(0, Math.floor(((t.top - box.top) / box.height) * 6)));
      var col = Math.min(7, Math.max(0, Math.floor(((t.left - box.left) / box.width) * 8)));
      el.textContent = ROWS[row] + (col + 1);
      el.setAttribute("title", "Zone " + ROWS[row] + (col + 1));
    });
  }

  document.querySelectorAll('a[href="#soi"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var d = document.getElementById("soi");
      var m = document.getElementById("soi-m");
      if (d && getComputedStyle(d).display !== "none") { d.open = true; return; }
      if (m) { e.preventDefault(); m.scrollIntoView({ block: "start" }); var f = m.querySelector("a"); if (f) f.focus({ preventScroll: true }); }
    });
  });

  var raf = 0;
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(zones); }
  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(plate);
  schedule();
})();
