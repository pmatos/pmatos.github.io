// Theme toggle ("Day" / "Night"). Contract: localStorage key "theme" holds
// "light" or "dark"; the class "dark" on <html> applies it; with nothing
// saved we follow prefers-color-scheme. The inline script in <head> applies
// the theme before first paint; this file only adds the button.
(function () {
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function saved() {
    try {
      var t = localStorage.getItem("theme");
      return t === "dark" || t === "light" ? t : null;
    } catch (e) {
      return null;
    }
  }

  function save(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
  }

  function current() {
    return root.classList.contains("dark") ? "dark" : "light";
  }

  var button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle";

  function render() {
    var dark = current() === "dark";
    button.textContent = dark ? "Day" : "Night";
    button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    button.title = dark ? "Switch to light theme" : "Switch to dark theme";
  }

  function apply(theme) {
    root.classList.toggle("dark", theme === "dark");
    if (window.REMARK42 && typeof window.REMARK42.changeTheme === "function") {
      window.REMARK42.changeTheme(theme);
    }
    render();
  }

  button.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    save(next);
    apply(next);
  });

  if (media) {
    var onChange = function (e) {
      if (!saved()) apply(e.matches ? "dark" : "light");
    };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else if (media.addListener) media.addListener(onChange);
  }

  function mount() {
    var slot = document.getElementById("theme-slot");
    (slot || document.body).appendChild(button);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
