// The index of sections: marks the section being read (aria-current), and
// lets the strip's Sections cell open the index. Without this script the
// index still lists and links every section.
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".soi-list a[href^='#']"));
  if (!links.length) return;

  document.querySelectorAll('a[href="#soi"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var d = document.getElementById("soi");
      var m = document.getElementById("soi-m");
      if (d && getComputedStyle(d).display !== "none") { d.open = true; return; }
      if (m) { e.preventDefault(); m.scrollIntoView({ block: "start" }); var f = m.querySelector("a"); if (f) f.focus({ preventScroll: true }); }
    });
  });

  var heads = [];
  links.forEach(function (a) {
    var h = document.getElementById(a.getAttribute("href").slice(1));
    if (h && heads.indexOf(h) < 0) heads.push(h);
  });
  if (!heads.length) return;

  var current = null;
  function mark() {
    var line = window.innerHeight * 0.3;
    var on = null;
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= line) on = heads[i]; else break;
    }
    var id = on ? on.id : null;
    if (id === current) return;
    current = id;
    links.forEach(function (a) {
      if (id && a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }
  var raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; mark(); }); }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  mark();
})();
