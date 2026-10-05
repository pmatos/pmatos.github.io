// Presentation filters for the "Engraved Technical Plate" templates.
// None of these touch collections, permalinks or markdown-it options, so
// post.templateContent (and therefore the RSS feeds) is never changed: the
// typographic finishing runs only where a layout calls `engrave`.
import markdownIt from "markdown-it";
import { DateTime } from "luxon";

const asDate = (d) =>
  d instanceof Date
    ? DateTime.fromJSDate(d, { zone: "utc" })
    : DateTime.fromISO(String(d), { zone: "utc" });

const ROMAN = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
export const roman = (n) => {
  let v = Number(n) || 0, out = "";
  for (const [k, s] of ROMAN) while (v >= k) { out += s; v -= k; }
  return out;
};

// Curly quotes, apostrophes, spaced en dashes, ellipses and ties on text
// nodes only. `prev` carries the last character across nodes, so a quote
// right after </em> still closes.
const OPENERS = /[\s([{—– /]/;
const smarten = (text, state) => {
  let out = "";
  const t = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const prev = i ? t[i - 1] : state.prev;
    if (c === '"') {
      out += !prev || OPENERS.test(prev) ? "“" : "”";
    } else if (c === "'") {
      const next = t[i + 1] || "";
      if (/\w/.test(prev || "") && /\w/.test(next)) out += "’";
      else out += !prev || OPENERS.test(prev) ? "‘" : "’";
    } else out += c;
  }
  if (t.length) state.prev = t[t.length - 1];
  return out
    .replace(/(^|[\s(“‘])(a|A|I) (?=\S)/g, "$1$2 ")
    .replace(/(\S) --? /g, "$1 – ")
    .replace(/(^|[^\s ])—(?=\S)/g, "$1 – ")
    .replace(/(\S) — /g, "$1 – ")
    .replace(/(?<!\.)\.\.\.(?!\.)/g, "…");
};
const SKIP = /^<\/?(code|pre|kbd|samp|svg|script|style|textarea|math|tt)\b/i;
export const finishHtml = (html) => {
  let depth = 0;
  const state = { prev: "" };
  return String(html ?? "")
    .split(/(<!--[\s\S]*?-->|<[^>]+>)/)
    .map((part, i) => {
      if (i % 2 === 1) {
        if (SKIP.test(part) && !part.endsWith("/>")) depth = part[1] === "/" ? Math.max(0, depth - 1) : depth + 1;
        return part;
      }
      return depth ? part : smarten(part, state).replace(/(?<![\w-])(\w+-\w{1,2}|\d{4}-\d{2}-\d{2})(?![\w-])/g, '<span class="nobr">$1</span>');
    })
    .join("");
};

const voiceOf = (tags) => (/\b(music|piano)/.test([].concat(tags || []).join(" ").toLowerCase()) ? "notes" : "code");

const LANGS = {
  c: "C", cpp: "C++", shell: "shell", bash: "shell", sh: "shell", nasm: "assembly", asm: "assembly",
  js: "JavaScript", javascript: "JavaScript", rust: "Rust", python: "Python", py: "Python", racket: "Racket",
  scheme: "Scheme", json: "JSON", yaml: "YAML", toml: "TOML", diff: "diff", text: "text", lisp: "Lisp",
  wat: "WebAssembly text", wasm: "WebAssembly", llvm: "LLVM IR", ts: "TypeScript", typescript: "TypeScript",
  html: "HTML", css: "CSS", vow: "Vow", ini: "INI", makefile: "Makefile", dockerfile: "Dockerfile",
};
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const numericCell = (cell) =>
  /^[~≈$+−-]?\s*\$?\d/.test(cell.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
const setTables = (html) =>
  html.replace(/<table\b[\s\S]*?<\/table>/g, (table) => {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/g) || [];
    const cells = (row) => row.match(/<(t[dh])\b[^>]*>[\s\S]*?<\/\1>/g) || [];
    const body = rows.filter((r) => /<td\b/.test(r));
    let out = table;
    if (body.length) {
      const width = Math.max(...body.map((r) => cells(r).length));
      const flush = [];
      for (let c = 0; c < width; c++) {
        const vals = body.map((r) => cells(r)[c]).filter(Boolean);
        if (vals.filter((v) => numericCell(v.replace(/^<t[dh][^>]*>|<\/t[dh]>$/g, ""))).length * 2 > vals.length) flush.push(c);
      }
      if (flush.length)
        out = table.replace(/<tr\b[\s\S]*?<\/tr>/g, (row) => {
          let c = -1;
          return row.replace(/<(t[dh])\b([^>]*)>/g, (tag, name, attrs) => {
            c++;
            if (!flush.includes(c)) return tag;
            return /class="/.test(attrs) ? tag.replace(/class="/, 'class="num ') : `<${name}${attrs} class="num">`;
          });
        });
    }
    return `<div class="table-wrap">${out}</div>`;
  });

// The body pass: figures, listings, music examples and section marks are
// numbered in reading order, and the text is finished.
export const engrave = (html, opts = {}) => {
  const voice = opts.voice || "code";
  const plate = opts.plate || "";
  let fig = 0, lst = 0, ex = 0;
  let out = finishHtml(html);

  // Listings: every <pre>, labelled and dimensioned by its line count.
  out = out.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g, (all, attrs, inner) => {
    lst++;
    const lang = (attrs.match(/language-([\w+-]+)/) || [])[1] || "";
    const name = LANGS[lang.toLowerCase()] || (lang ? lang : "");
    const text = inner.replace(/<[^>]+>/g, "").replace(/\n+$/, "");
    const lines = text.split("\n").length;
    const cap = `<figcaption class="lst-cap"><span class="lst-no">Listing ${lst}</span>${name ? `<span class="lst-lang">${name}</span>` : ""}</figcaption>`;
    const dim = lines > 2 ? `<span class="lst-dim" aria-hidden="true"><span>${lines} lines</span></span>` : "";
    return `<figure class="listing">${cap}<div class="lst-body"><pre${attrs} tabindex="0">${inner}</pre>${dim}</div></figure>`;
  });

  // Images alone in a paragraph or a wrapper div become numbered figures,
  // captioned with their alt text. A narrow, right-aligned sketch is a side figure.
  out = out.replace(/<(p|div)\b([^>]*)>\s*(<img\b[^>]*>)\s*<\/\1>/g, (all, tag, attrs, img) => {
    fig++;
    const alt = (img.match(/\balt="([^"]*)"/) || [])[1] || "";
    const w = (img.match(/\bwidth="(\d+)%"/) || [])[1];
    const side = w && Number(w) < 50 && /flex-end/.test(attrs);
    const isSvg = /\.svg"/.test(img);
    const cls = ["fig", side ? "fig--side" : "", w && !side ? "fig--narrow" : "", isSvg ? "fig--line" : ""].filter(Boolean).join(" ");
    const style = w ? ` style="--fig-w:${w}%"` : "";
    const cleanImg = img.replace(/\swidth="\d+%"/, "").replace(/<img\b/, '<img loading="lazy" decoding="async"');
    return `<figure class="${cls}"${style}><div class="fig-frame">${cleanImg}</div><figcaption><span class="fig-no">Fig. ${fig}</span>${alt ? ` <span class="fig-alt">${alt}</span>` : ""}</figcaption></figure>`;
  });

  // LilyPond output: sized from its viewBox (10px per staff space) and numbered.
  out = out.replace(
    /<svg\b([^>]*?)\swidth="[\d.]+mm"\sheight="[\d.]+mm"\sviewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"([^>]*)>([\s\S]*?)<\/svg>/g,
    (all, pre, x, y, w, h, post, inner) => {
      ex++;
      return `<figure class="ly-ex" style="--ly-w:${w}"><figcaption class="ly-cap"><span class="fig-no">Ex. ${ex}</span></figcaption><svg${pre} viewBox="${x} ${y} ${w} ${h}"${post} role="img" aria-label="Music example ${ex}, engraved with LilyPond">${inner}</svg></figure>`;
    },
  );

  // Section marks on the top heading level of the piece: a drafting section
  // bubble (letter over plate number) for code, a rehearsal letter for music.
  const level = /<h1\b/.test(out) ? "h1" : "h2";
  if (level === "h1") out = out.replace(/<(\/?)h3\b/g, "<$1h4").replace(/<(\/?)h2\b/g, "<$1h3");
  let sec = 0;
  out = out.replace(new RegExp(`<${level}\\b([^>]*)>([\\s\\S]*?)<\\/${level}>`, "g"), (all, attrs, inner) => {
    const L = LETTERS[sec++ % LETTERS.length];
    const mark =
      voice === "notes"
        ? `<span class="reh" aria-hidden="true">${L}</span>`
        : `<span class="secmark" aria-hidden="true"><b>${L}</b>${plate ? `<i>${plate}</i>` : ""}</span>`;
    return `<h2 class="sec" id="section-${L.toLowerCase()}"${attrs}>${mark}<span class="sec-t">${inner}</span></h2>`;
  });

  // Footnote references without brackets.
  out = out.replace(/(<sup class="footnote-ref"><a [^>]*>)\[(\d+)\](<\/a>)/g, "$1$2$3");
  return setTables(out);
};

export default function plate(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/_11ty/_static/js": "js" });
  eleventyConfig.addGlobalData("build", () => ({ date: new Date() }));

  eleventyConfig.addFilter("roman", roman);
  eleventyConfig.addFilter("finishHtml", finishHtml);
  eleventyConfig.addFilter("engrave", (html, voice, plateNo) => engrave(html, { voice, plate: plateNo }));

  const inlineMd = markdownIt({ html: true });
  eleventyConfig.addFilter("inlineMd", (s) => finishHtml(inlineMd.renderInline(String(s ?? "").trim())));
  const plain = markdownIt("zero");
  eleventyConfig.addFilter("smartText", (s) => finishHtml(plain.renderInline(String(s ?? ""))));

  // A link log summary: a head of about two sentences and the remainder.
  eleventyConfig.addFilter("llSplit", (s, target = 260) => {
    const html = plain.renderInline(String(s ?? "").replace(/\s+/g, " ").trim());
    const done = (head, tail) => ({ head: finishHtml(head), tail: finishHtml(tail) });
    if (html.length <= target + 80) return done(html, "");
    let end = -1;
    for (const m of html.matchAll(/[.!?:](&quot;|[”’)])*(?=\s)/g)) {
      const at = m.index + m[0].length;
      if (at > target + 40) break;
      if (at >= 110) end = at;
    }
    if (end > 0) return done(html.slice(0, end), html.slice(end));
    const sp = html.lastIndexOf(" ", target);
    return done(html.slice(0, sp), html.slice(sp));
  });

  eleventyConfig.addFilter("plateNo", (collection, url) => {
    const i = (collection || []).findIndex((p) => p.url === url);
    return i < 0 ? 0 : i + 1;
  });
  eleventyConfig.addFilter("voice", voiceOf);
  eleventyConfig.addFilter("voiceCount", (collection, v) => (collection || []).filter((p) => voiceOf(p.data?.tags) === v).length);

  eleventyConfig.addFilter("readingMinutes", (html) => {
    const text = String(html ?? "").replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
    return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 230));
  });
  eleventyConfig.addFilter("tempo", (m) =>
    m <= 2 ? "Presto" : m <= 4 ? "Allegro" : m <= 6 ? "Allegretto" : m <= 9 ? "Andante" : m <= 13 ? "Adagio" : "Largo",
  );
  eleventyConfig.addFilter("tally", (html) => {
    const s = String(html ?? "");
    return {
      figures: (s.match(/<img\b/g) || []).length,
      listings: (s.match(/<pre\b/g) || []).length,
      examples: (s.match(/<svg\b[^>]*\swidth="[\d.]+mm"/g) || []).length,
      sections: (s.match(/<h1\b/g) || []).length || (s.match(/<h2\b/g) || []).length,
      notes: (s.match(/class="footnote-item"/g) || []).length,
    };
  });

  const TAG_NAMES = {
    riscv: "RISC-V", webkit: "WebKit", javascript: "JavaScript", creduce: "C-Reduce", racket: "Racket",
    bitvector: "bitvectors", rosette: "Rosette", "piano-playing": "piano", webassembly: "WebAssembly",
    llvm: "LLVM", "reference-types": "reference types", fex: "FEX-Emu", genai: "GenAI", claude: "Claude",
    llms: "LLMs", waybar: "Waybar", linux: "Linux", esbmc: "ESBMC", rightkey: "Rightkey", rust: "Rust",
    codex: "Codex", pewpew: "Pewpew", vow: "Vow", igalia: "Igalia", bv: "bv",
  };
  eleventyConfig.addFilter("indexTerms", (tags) => {
    const out = [];
    for (const t of [].concat(tags || []))
      for (const part of String(t).split(/[\s,]+/)) {
        const slug = part.replace(/^#+/, "").trim().toLowerCase();
        if (!slug || slug === "post" || slug === "posts" || slug === "pages" || /^\d+$/.test(slug)) continue;
        const name = TAG_NAMES[slug] || slug.replace(/-/g, " ");
        if (!out.includes(name)) out.push(name);
      }
    return out;
  });

  const groupBy = (items, keyOf, labelOf) => {
    const groups = [];
    for (const item of items || []) {
      const key = keyOf(item);
      const last = groups.at(-1);
      if (last && last.key === key) last.items.push(item);
      else groups.push({ key, label: labelOf(item), items: [item] });
    }
    return groups;
  };
  eleventyConfig.addFilter("groupByYear", (posts) => groupBy(posts, (p) => asDate(p.date).year, (p) => String(asDate(p.date).year)));
  eleventyConfig.addFilter("groupByMonth", (entries, field = "dateAdded") =>
    groupBy(entries, (e) => asDate(e[field]).toFormat("yyyy-LL"), (e) => asDate(e[field]).toFormat("LLLL yyyy")),
  );
  eleventyConfig.addFilter("plateDate", (d) => asDate(d).toFormat("d LLL yyyy"));
  eleventyConfig.addFilter("dayMonth", (d) => asDate(d).toFormat("d LLL"));
  eleventyConfig.addFilter("isoDate", (d) => asDate(d).toISODate());
  eleventyConfig.addFilter("yearOf", (d) => asDate(d).year);
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("domain", (u) => {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
  });
  eleventyConfig.addFilter("leadH1", (html) => (String(html ?? "").match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "");
  eleventyConfig.addFilter("dropLeadH1", (html) => String(html ?? "").replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/, ""));
}
