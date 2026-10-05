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
    .replace(/(?<!\.)\.\.\.(?!\.)/g, "…")
    .replace(/(\d)x(?=[\s,.;:)]|$)/g, "$1×")
    .replace(/(^|[\s(])~(?=\d)/g, "$1≈");
};

// Words that need help from the compositor: ISO dates and short hyphenated
// compounds (x86-64, Middle-C) must not break; capitals with figures (ARM64,
// S10, ST0) take lining figures so the digits stand on the cap line.
const TIES = /(?<=^|\s)(the|a|an)\s+(?=[^\s<])/gi;
const wrapTokens = (text, ties) => {
  let out = text.replace(/(?<![\w&#;-])(\w+(?:-\w+)*)(?![\w-])/g, (tok) => {
    const nobr = /^\d{4}-\d{2}-\d{2}$/.test(tok) || /^\w+-\w{1,2}$/.test(tok);
    const lnum = /^[A-Za-z]/.test(tok) && /[A-Z]/.test(tok) && /\d/.test(tok);
    const cls = [nobr ? "nobr" : "", lnum ? "lnum" : ""].filter(Boolean).join(" ");
    return cls ? `<span class="${cls}">${tok}</span>` : tok;
  });
  if (ties) out = out.replace(TIES, "$1\u00a0");
  return out;
};
const SKIP = /^<\/?(code|pre|kbd|samp|svg|script|style|textarea|math|tt)\b/i;
export const finishHtml = (html, ties = false) => {
  let depth = 0;
  const state = { prev: "" };
  return String(html ?? "")
    .split(/(<!--[\s\S]*?-->|<[^>]+>)/)
    .map((part, i) => {
      if (i % 2 === 1) {
        if (SKIP.test(part) && !part.endsWith("/>")) depth = part[1] === "/" ? Math.max(0, depth - 1) : depth + 1;
        return part;
      }
      return depth ? part : wrapTokens(smarten(part, state), ties);
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

const cellText = (cell) => cell.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
const strictNumber = (cell) =>
  /^[~≈$+−-]?\s*\$?[\d.,]+\s*(%|×|x|ms|s|k|K|M|KB|MB|GB|min|h)?$/.test(cellText(cell));
const setTables = (html) =>
  html.replace(/<table\b[\s\S]*?<\/table>/g, (table) => {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/g) || [];
    const cells = (row) => row.match(/<(t[dh])\b[^>]*>[\s\S]*?<\/\1>/g) || [];
    const inner = (v) => v.replace(/^<t[dh][^>]*>|<\/t[dh]>$/g, "");
    const body = rows.filter((r) => /<td\b/.test(r));
    let out = table;
    let width = 0;
    if (body.length) {
      width = Math.max(...body.map((r) => cells(r).length));
      const flush = [];
      for (let c = 0; c < width; c++) {
        const vals = body.map((r) => cells(r)[c]).filter(Boolean);
        if (vals.filter((v) => strictNumber(inner(v))).length * 5 >= vals.length * 4) flush.push(c);
      }
      // A column of figures is set flush right; a column that mixes figures
      // with dates or words stays flush left, with tabular figures.
      if (flush.length)
        out = table.replace(/<tr\b[\s\S]*?<\/tr>/g, (row) => {
          let c = -1;
          return row.replace(/<(t[dh])\b([^>]*)>([\s\S]*?)(?=<\/\1>)/g, (all, name, attrs, content) => {
            c++;
            if (!flush.includes(c)) return all;
            if (name === "td" && !strictNumber(content)) return all;
            const tag = /class="/.test(attrs) ? `<${name}${attrs.replace(/class="/, 'class="num ')}>` : `<${name}${attrs} class="num">`;
            return tag + content;
          });
        });
    }
    return `<div class="table-wrap${width === 2 ? " table-wrap--pair" : ""}">${out}</div>`;
  });

// Listings: the source's common indent is removed, and a listing without a
// declared language is identified from its text where that is unambiguous.
const dedent = (code) => {
  let lines = code.split("\n").map((l) => l.replace(/^[ \u00a0\t]+/, (m) => m.replace(/\u00a0/g, " ")));
  const live = () => lines.filter((l) => l.replace(/<[^>]+>/g, "").trim());
  for (let guard = 0; guard < 40; guard++) {
    const l = live();
    if (!l.length) break;
    if (l.every((x) => x.startsWith("\t"))) lines = lines.map((x) => x.replace(/^\t/, ""));
    else if (l.every((x) => x.startsWith(" "))) lines = lines.map((x) => x.replace(/^ /, ""));
    else break;
  }
  return lines.join("\n");
};
const X86 = /^\s*(mov\w*|sub|add|lea|push|pop|call|ret|jmp|j[a-z]{1,3}|cmp|test|xor|and|or|not|neg|nop|inc|dec|imul|mul|idiv|div|sh[lr]|sa[lr]|cvt\w+|f[a-z]{2,8})\s/;
const guessLang = (text) => {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return "";
  if (lines.some((l) => /^\s*(\(%\d+ i\d+\)|%\d+ i\d+ =)/.test(l))) return "FEX-Emu IR";
  if (lines.filter((l) => X86.test(l)).length / lines.length >= 0.6) return "x86 assembly";
  if (lines.filter((l) => /^\s*\$ /.test(l)).length / lines.length >= 0.5) return "shell";
  return "text";
};

// A bare x86 listing is lettered like a highlighted one: the mnemonic as a
// keyword, immediates as numbers, brackets and commas as punctuation.
const asmTokens = (body) =>
  body.replace(/^([ \t]*)([a-z][a-z0-9]*)(?=[ \t]|$)(.*)$/gm, (all, ws, op, rest) =>
    `${ws}<span class="token keyword">${op}</span>` +
    rest
      .replace(/(?<![\w#&])(#?(?:0x[0-9a-f]+|\d+))(?!\w)/gi, '<span class="token number">$1</span>')
      .replace(/([[\],])/g, '<span class="token punctuation">$1</span>'));

const LETTER = (i) => LETTERS[i % LETTERS.length];
const headingLevel = (html) => (/<h1\b/.test(html) ? "h1" : "h2");

// The section marks of a piece, in order, for the index of sections.
export const sectionsOf = (html) => {
  const s = String(html ?? "");
  const level = headingLevel(s);
  const out = [];
  for (const m of s.matchAll(new RegExp(`<${level}\\b[^>]*>([\\s\\S]*?)<\\/${level}>`, "g"))) {
    const L = LETTER(out.length);
    // Where the section starts, in minutes of reading.
    const before = s.slice(0, m.index);
    const words = before.replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    out.push({ letter: L, id: `section-${L.toLowerCase()}`, minute: Math.floor(words / 230), title: finishHtml(m[1].replace(/<(?!\/?(code|em|i)\b)[^>]+>/g, "").replace(/\s*:\s*$/, "")) });
  }
  return out;
};

// The body pass: figures, listings, music examples and section marks are
// numbered in reading order, and the text is finished.
export const engrave = (html, opts = {}) => {
  const voice = opts.voice || "code";
  const plate = opts.plate || "";
  let fig = 0, lst = 0, ex = 0;
  let out = finishHtml(html);

  out = out.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g, (all, attrs, inner) => {
    lst++;
    const m = inner.match(/^(<code\b[^>]*>)([\s\S]*?)(<\/code>)?$/);
    const body = m ? m[1] + dedent(m[2].replace(/\n+$/, "")) + (m[3] || "") : dedent(inner);
    const lang = (attrs.match(/language-([\w+-]+)/) || [])[1] || "";
    const text = body.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const name = LANGS[lang.toLowerCase()] || lang || guessLang(text);
    const lettered = !lang && name === "x86 assembly" && !/<span\b/.test(body) ? body.replace(/^(<code\b[^>]*>)?([\s\S]*?)(<\/code>)?$/, (a, o, t, c) => (o || "") + asmTokens(t) + (c || "")) : body;
    const lines = text.replace(/\n+$/, "").split("\n").length;
    const cap = `<figcaption class="lst-cap"><span class="lst-no">Listing ${lst}</span>${name ? `<span class="lst-lang">${name}</span>` : ""}</figcaption>`;
    const dim = lines > 2 ? `<span class="lst-dim" aria-hidden="true"><span>${lines} lines</span></span>` : "";
    return `<figure class="listing${lines === 1 ? " listing--line" : ""}">${cap}<div class="lst-body"><pre${attrs} tabindex="0">${lettered}</pre>${dim}</div></figure>`;
  });

  // Images alone in a paragraph or a wrapper div become numbered figures,
  // captioned with their alt text (a narrow, right-aligned sketch is a side
  // figure). Charts a post brings with its own caption share the numbering.
  out = out.replace(
    /<(p|div)\b([^>]*)>\s*(<img\b[^>]*>)\s*<\/\1>|(<figure class="jsse-chart"[^>]*>[\s\S]*?<figcaption>)([\s\S]*?)(<\/figcaption>)/g,
    (all, tag, attrs, img, chartHead, chartCap, chartEnd) => {
      fig++;
      if (chartHead) return `${chartHead}<span class="fig-no">Fig. ${fig}</span> <span class="fig-alt">${chartCap}</span>${chartEnd}`;
      const alt = (img.match(/\balt="([^"]*)"/) || [])[1] || "";
      const w = (img.match(/\bwidth="(\d+)%"/) || [])[1];
      const side = w && Number(w) < 50 && /flex-end/.test(attrs);
      const isSvg = /\.svg"/.test(img);
      const cls = ["fig", side ? "fig--side" : "", w && !side ? "fig--narrow" : "", isSvg ? "fig--line" : ""].filter(Boolean).join(" ");
      const style = w ? ` style="--fig-w:${w}%"` : "";
      const cleanImg = img.replace(/\swidth="\d+%"/, "").replace(/<img\b/, '<img loading="lazy" decoding="async"');
      return `<figure class="${cls}"${style}><div class="fig-frame">${cleanImg}</div><figcaption><span class="fig-no">Fig. ${fig}</span>${alt ? ` <span class="fig-alt">${finishHtml(alt)}</span>` : ""}</figcaption></figure>`;
    },
  );

  out = out.replace(
    /<svg\b([^>]*?)\swidth="[\d.]+mm"\sheight="[\d.]+mm"\sviewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"([^>]*)>([\s\S]*?)<\/svg>/g,
    (all, pre, x, y, w, h, post, inner) => {
      ex++;
      return `<figure class="ly-ex" style="--ly-w:${w}"><figcaption class="ly-cap"><span class="fig-no">Ex. ${ex}</span></figcaption><svg${pre} viewBox="${x} ${y} ${w} ${h}"${post} role="img" aria-label="Music example ${ex}, engraved with LilyPond">${inner}</svg></figure>`;
    },
  );

  // Section marks on the top heading level: a drafting section bubble
  // (letter over plate number) for code, a rehearsal letter for music.
  const level = headingLevel(out);
  if (level === "h1") out = out.replace(/<(\/?)h3\b/g, "<$1h4").replace(/<(\/?)h2\b/g, "<$1h3");
  let sec = 0;
  out = out.replace(new RegExp(`<${level}\\b([^>]*)>([\\s\\S]*?)<\\/${level}>`, "g"), (all, attrs, inner) => {
    const L = LETTER(sec++);
    const mark =
      voice === "notes"
        ? `<span class="reh" aria-hidden="true">${L}</span>`
        : `<span class="secmark" aria-hidden="true"><b>${L}</b>${plate ? `<i>${plate}</i>` : ""}</span>`;
    return `<h2 class="sec" id="section-${L.toLowerCase()}"${attrs}>${mark}<span class="sec-t">${inner.replace(/\s*:\s*$/, "")}</span></h2>`;
  });

  out = out.replace(/(<sup class="footnote-ref"><a [^>]*>)\[(\d+(?::\d+)?)\](<\/a>)/g, "$1$2$3");
  // A bare URL in the text is set as code, so its break reads as a code break.
  out = out.replace(/<a\b((?![^>]*\bclass=)[^>]*)>(https?:\/\/[^<\s]+)<\/a>/g, '<a$1 class="url">$2</a>');
  return setTables(out);
};

export default function plate(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/_11ty/_static/js": "js" });
  eleventyConfig.addGlobalData("build", () => ({ date: new Date() }));

  eleventyConfig.addFilter("roman", roman);
  eleventyConfig.addFilter("finishHtml", finishHtml);
  eleventyConfig.addFilter("engrave", (html, voice, plateNo) => engrave(html, { voice, plate: plateNo }));

  const inlineMd = markdownIt({ html: true });
  eleventyConfig.addFilter("inlineMd", (s, ties = false) => finishHtml(inlineMd.renderInline(String(s ?? "").trim()), ties));
  eleventyConfig.addFilter("sections", sectionsOf);
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
      // A head never ends on a colon: it would promise a list it then hides.
      if (at >= 110 && m[0][0] !== ":") end = at;
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
  eleventyConfig.addFilter("ofVoice", (collection, v) => (collection || []).filter((p) => voiceOf(p.data?.tags) === v));
  eleventyConfig.addFilter("byUrl", (collection, url) => (collection || []).find((p) => p.url === url));
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
      figures: (s.match(/<img\b/g) || []).length + (s.match(/<figure class="jsse-chart"/g) || []).length,
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
