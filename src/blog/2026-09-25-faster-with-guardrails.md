---
title: "Faster, With Guardrails"
description: "Six months after JSSE's first release: 47 of 48 JetStream workloads run, up from 22, and 2.92x faster on the ones March could run. test262 is still at 100%. Agents can make an engine faster, as long as the guardrails hold."
tags: ["javascript", "claude", "rust", "agentic-coding", "performance"]
date: 2026-09-25
image: /img/2026/09/jsse-guardrails.png
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
comments: true
---

![A small robot sprinting down a track lined with glowing checkmark guardrails](/img/2026/09/jsse-guardrails.png)

In March, [JSSE](https://github.com/pmatos/jsse) was a JavaScript engine an agent had built from scratch in Rust: [correct and slow](/blog/jsse-a-javascript-engine-built-by-an-agent.html). In May, I wrote about [making it faster](/blog/how-fast-do-you-want-it.html) without touching its architecture, and said that post was not about bytecode.

Six months after the first release, JSSE v0.9.0 runs **47 of the 48** JetStream workloads, up from 22 in March. On the 22 that both versions run, it is **2.92x faster** (geometric mean). And it still passes every one of the 99,911 test262 scenarios we run.

I still haven't written a line of it. What I did build is the guardrails, and I think the guardrails are the actual story. Agent-driven performance work is possible. It is only trustworthy if the agent cannot quietly trade correctness for speed.

## Still 100%

test262 keeps growing. The March build passed the suite as it stood then[^runner]. Run against today's checkout, it fails 1,039 of 99,911 scenarios, mostly tests for features that landed since: iterator helpers, `Promise.allKeyed`, immutable `ArrayBuffer`s, `Atomics.waitAsync`. v0.9.0 passes all of them, both on the default tree-walker and with the experimental bytecode VM.

Same checkout, same runner, same 120-second timeout for every engine. Tick the boxes to add or remove engines.

{% raw %}
<figure class="jsse-chart" id="chart-t262"><div class="jsse-filters" role="group" aria-label="Engines shown"></div><div class="jsse-canvas" style="height:260px"><canvas role="img" aria-label="test262 failing scenarios per engine; table below"></canvas></div><figcaption>Failing test262 scenarios out of 99,911 (lower is better). engine262 is estimated from a 10% sample.</figcaption></figure>
{% endraw %}

<details>
<summary>test262 table</summary>

| Engine | Pass | Run | Pass rate |
|---|---:|---:|---:|
| JSSE v0.9.0 | 99,911 | 99,911 | 100% |
| JSSE v0.9.0 `--bytecode` | 99,911 | 99,911 | 100% |
| JSSE March (v0.1.0) | 98,872 | 99,911 | 98.96% |
| Node v26.9.0 (V8) | 95,353 | 99,081 | 96.24% |
| engine262 | 10,342 | 11,752 (10% sample) | ≈88.0% |
| Boa v0.22 | 84,767 | 99,911 | 84.84% |

</details>

I'm not claiming JSSE is more conformant than V8. Node goes through a test adapter with a basic `$262.agent` and skips 830 module scenarios, so some of its failures belong to the harness, not to V8. The claim is narrower: an engine built and optimized by an agent sits at the top of this table, and it didn't slip while getting faster.

## The Guardrails

Performance work is where an agent is most dangerous. A fast path that skips a spec step passes the benchmark and breaks something three clauses away. So nothing merges without getting past three kinds of guardrail.

**Correctness.** Every PR runs the full test262 suite locally and compares against a pass-list baseline read from `main`. A single regression blocks the merge. The agent cannot move the baseline, cannot touch the test262 or spec submodules, and is told to implement the spec, not the test: special-casing a test file is not a fix. CI re-runs a seeded sample of test262, plus `test262-extra`, a first-party suite for spec behaviour test262 doesn't reach, in both execution modes.

**Measurement.** Performance claims need receipts. Benchmarks run under a fixed protocol: the same machine, five process runs, the median, a load gate, a pinned JetStream commit, and benchmark scripts that don't change between versions. Results land in the repository's `docs/perf/` as data, null results included. When the bytecode VM failed to speed up tweetnacl, that got written up too.

**Scope.** The work runs through [Symphonika](https://github.com/pmatos/symphonika), an orchestrator I've been building that turns GitHub issues into agent runs. More on it in a post soon. Each issue goes through a fixed pipeline: plan, implement, code review, simplify, then wait for CI and review threads, autofix, merge. Each step has a gate. The plan must cite the spec clauses it relies on. An implementation that doesn't push a commit never gets to open a PR. One issue, one branch, one PR. Between May and September that came to about 700 commits across some 270 PRs.

Here is a guardrail catching something. In late August, a correctness fix made `JSON.stringify` honour Proxy property descriptors. It was spec-correct and test262 was happy. It also sent every key of every *ordinary* object through the Proxy path, allocating a descriptor object per property. JetStream's `json-stringify-inspector` got almost three times slower. The next benchmark snapshot flagged it as slower than March, an issue got filed, and the fix (read `[[GetOwnProperty]]` directly for non-proxy objects) was released two days later.

The guardrail didn't prevent the regression. It made the regression visible, three weeks after it landed. Measurement is periodic, not per-PR, and that gap is the next thing to close.

## Where the Speed Came From

Unlike in May, most of this round's gains came from architecture:

- **NaN-boxed values.** A `JsValue` went from a roughly 32-byte enum to one 64-bit word.
- **Generational GC.** A non-moving nursery with a remembered set and a write barrier, so short-lived objects die cheap.
- **Arena allocation** for objects.
- **Polymorphic inline caches** for property reads and call sites. They are not hidden classes yet: an entry matches one object, not a shape shared across objects.
- **A bytecode VM**, behind `--bytecode`.

The VM is the one that hasn't paid off yet. Entering a compiled function costs about 350 ns, and each bytecode op saves about 22 ns over the tree-walker, so break-even is around 16 ops. On mandreel the average compiled function is 15.9 ops long: 96.5% of calls run compiled, but only 13% of the work does. That is why it's off by default: 3.8% better on JetStream (geometric mean), up to 1.7x on navier-stokes, and slower on a few workloads.

## The Numbers

Nine small scripts, each timed as a whole process (startup included), median of five runs. The comparison that matters is with [Boa](https://github.com/boa-dev/boa), another engine written in Rust without a JIT. Node is available in the chart, but it lives in a different universe: its ~0.1 s times are mostly process startup.

{% raw %}
<figure class="jsse-chart" id="chart-micro"><div class="jsse-filters" role="group" aria-label="Engines shown"></div><div class="jsse-canvas" style="height:380px"><canvas role="img" aria-label="Micro-benchmark times per engine on a log scale; table below"></canvas></div><figcaption>Micro-benchmarks, median wall-clock seconds, log scale (lower is better). Hatched bars hit the 120 s timeout.</figcaption></figure>
{% endraw %}

<details>
<summary>Micro-benchmark table (seconds)</summary>

| Benchmark | JSSE March | JSSE v0.9.0 | v0.9.0 `--bytecode` | Boa v0.22 | Node v26.9.0 | engine262 |
|---|---:|---:|---:|---:|---:|---:|
| loop | 3.18 | 2.09 | 2.10 | 2.07 | 0.12 | timeout |
| fib | 31.72 | 4.01 | 3.58 | 1.34 | 0.13 | timeout |
| string | 5.47 | 1.04 | 1.06 | 0.53 | 0.13 | 14.20 |
| array | timeout | 27.54 | 27.72 | 0.33 | 0.12 | 102.78 |
| object | 0.92 | 0.67 | 0.66 | 0.61 | 0.25 | 58.30 |
| regex | 5.97 | 0.10 | 0.10 | 0.15 | 0.10 | 8.49 |
| closures | 15.70 | 5.28 | 5.72 | 2.37 | 0.20 | timeout |
| json | 0.27 | 0.18 | 0.18 | 0.31 | 0.12 | 8.44 |
| opmix | 70.69 | 25.76 | 20.19 | 5.69 | 0.12 | timeout |

</details>

Against March, v0.9.0 is 1.4x faster on `loop`, 7.9x on `fib` and 57x on `regex`, and `array` went from a timeout to 27.5 s. Against Boa, it roughly ties on loops and object access, wins on regex and JSON, trails by 2–4x on calls, closures, strings and `opmix`, and then there's `array`.

JetStream is the more realistic workload. v0.9.0 passes 47 of 48 (mandreel still times out). March passed 22. Here is each of those 22, v0.9.0 against March:

{% raw %}
<figure class="jsse-chart" id="chart-js"><div class="jsse-filters" role="group" aria-label="Builds shown"></div><div class="jsse-canvas" style="height:600px"><canvas role="img" aria-label="JetStream per-workload speedup over the March build, log scale; table below"></canvas></div><figcaption>JetStream speedup over the March build per workload, log scale (right of 1x is faster). Median of 3 runs.</figcaption></figure>
{% endraw %}

<details>
<summary>JetStream table (ms, median of 3)</summary>

| Workload | March | v0.9.0 | Speedup | `--bytecode` | Speedup |
|---|---:|---:|---:|---:|---:|
| FlightPlanner | 16,993 | 1,149 | 14.79x | 1,096 | 15.51x |
| ai-astar | 54,206 | 5,026 | 10.79x | 4,849 | 11.18x |
| hash-map | 114,009 | 14,314 | 7.97x | 13,905 | 8.20x |
| earley-boyer | 31,348 | 5,484 | 5.72x | 5,230 | 5.99x |
| UniPoker | 20,899 | 4,723 | 4.42x | 4,588 | 4.56x |
| bigint-bigdenary | 17,858 | 4,241 | 4.21x | 4,169 | 4.28x |
| delta-blue | 22,067 | 6,151 | 3.59x | 5,579 | 3.96x |
| raytrace-private-class-fields | 51,397 | 14,537 | 3.54x | 14,619 | 3.52x |
| octane-code-load | 138 | 40 | 3.45x | 60 | 2.30x |
| richards | 30,200 | 10,655 | 2.83x | 10,159 | 2.97x |
| raytrace | 36,919 | 13,323 | 2.77x | 11,624 | 3.18x |
| Box2D | 16,661 | 6,992 | 2.38x | 6,502 | 2.56x |
| gbemu | 57,875 | 27,039 | 2.14x | 25,453 | 2.27x |
| crypto | 11,694 | 5,491 | 2.13x | 4,482 | 2.61x |
| pdfjs | 23,051 | 11,524 | 2.00x | 11,474 | 2.01x |
| navier-stokes | 8,882 | 4,822 | 1.84x | 2,811 | 3.16x |
| stanford-crypto-aes | 13,812 | 7,831 | 1.76x | 7,817 | 1.77x |
| stanford-crypto-sha256 | 8,839 | 5,197 | 1.70x | 4,428 | 2.00x |
| stanford-crypto-pbkdf2 | 8,187 | 4,817 | 1.70x | 4,075 | 2.01x |
| gaussian-blur | 53,281 | 31,433 | 1.70x | 22,870 | 2.33x |
| json-parse-inspector | 1,326 | 1,176 | 1.13x | 1,201 | 1.10x |
| json-stringify-inspector | 537 | 561 | 0.96x | 563 | 0.95x |

</details>

From 14.8x on FlightPlanner down to 0.96x on `json-stringify-inspector`, which is back from the regression above but still 4% short of March. Geometric mean 2.92x, median 2.58x. Twenty-five workloads run now that didn't in March[^runner-js].

## What's Still Bad

**Arrays.** `bench_array` pushes 100,000 numbers, maps them and reduces them. It takes 27.5 s in JSSE and 0.33 s in Boa. While writing this post I found out why: building a result array in `map`, `filter` or `slice` is quadratic. Each element is written into the dense storage and then *also* defined as a named property, and that path does a linear scan over the object's property list. `push` is linear; `map` is not. It is the kind of bug that survives because test262 checks what the answer is, not how long it takes to get there.

**Bytecode** barely helps. Entry cost and coverage gaps (whole functions fall back to the tree-walker over a single labelled statement) eat the gains.

**No hidden classes.** Property access is cached per object, not per shape.

**mandreel** still times out.

None of this is surprising. What the guardrails buy me is being able to say so with a straight face: every number here is in the repository, including the embarrassing ones.

## What's Next

Fix arrays. Make bytecode pay for itself by cutting the entry cost and closing the coverage gaps, so it can be on by default. Real shapes. And the Symphonika post, because the orchestrator is now doing more of the work than I am.

All numbers come from [`docs/perf/2026-09-25/engine-comparison.json`](https://github.com/pmatos/jsse/blob/main/docs/perf/2026-09-25/engine-comparison.json)[^method].

[^runner]: Almost. In May, [@ivankra found](https://github.com/pmatos/jsse/issues/58) that JSSE's test runner was classifying some failures as passes, so March's "100%" was really a little less. Fixing the runner was a guardrail too.

[^runner-js]: The script that drives JetStream was fixed along the way as well. A control run of an earlier engine build under the new runner suggests about a third of those 25 pass because of runner fixes rather than engine changes. Speedups only compare workloads that pass in both builds.

[^method]: test262 ran on my laptop; load affects timings there, not pass/fail. Performance ran on a shared build machine with someone else's jobs running, so expect a few percent of noise. Only v0.9.0 was measured on September 25; the other engines were measured a week earlier on the same machine with the same protocol.

{% raw %}
<style>
.jsse-chart{margin:2rem 0}
.jsse-chart figcaption{font-size:.85rem;color:var(--color-text-muted);margin-top:.5rem}
.jsse-filters{display:flex;flex-wrap:wrap;gap:.4rem .9rem;margin-bottom:.6rem;font-size:.85rem}
.jsse-filters label{display:inline-flex;align-items:center;gap:.35rem;cursor:pointer;color:var(--color-text);user-select:none}
.jsse-filters input{accent-color:var(--color-accent);margin:0}
.jsse-swatch{display:inline-block;width:.8rem;height:.8rem;border-radius:3px}
.jsse-canvas{position:relative;width:100%}
</style>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
<script>
(function () {
  if (!window.Chart) return;
  var ENGINES = [
    { k: "v09", name: "JSSE v0.9.0", light: "#2a78d6", dark: "#3987e5" },
    { k: "mar", name: "JSSE March", light: "#eb6834", dark: "#d95926" },
    { k: "boa", name: "Boa v0.22", light: "#1baf7a", dark: "#199e70" },
    { k: "bc", name: "JSSE v0.9.0 --bytecode", light: "#eda100", dark: "#c98500" },
    { k: "node", name: "Node v26.9.0", light: "#e87ba4", dark: "#d55181" },
    { k: "e262", name: "engine262", light: "#008300", dark: "#008300" }
  ];
  var byKey = {};
  ENGINES.forEach(function (e) { byKey[e.k] = e; });

  var T262 = {
    v09: { fail: 0, note: "100% of 99,911" },
    mar: { fail: 1039, note: "98.96% of 99,911" },
    boa: { fail: 15144, note: "84.84% of 99,911" },
    bc: { fail: 0, note: "100% of 99,911" },
    node: { fail: 3728, note: "96.24% of 99,081 run (830 skipped)" },
    e262: { fail: 11990, note: "≈88.0%, estimated from a 10% sample" }
  };
  var BENCHES = ["loop", "fib", "string", "array", "object", "regex", "closures", "json", "opmix"];
  var MICRO = {
    v09: [2.093, 4.011, 1.043, 27.54, 0.668, 0.104, 5.284, 0.176, 25.764],
    mar: [3.185, 31.72, 5.465, null, 0.92, 5.974, 15.704, 0.275, 70.691],
    boa: [2.073, 1.339, 0.531, 0.329, 0.615, 0.15, 2.374, 0.31, 5.693],
    bc: [2.104, 3.577, 1.063, 27.717, 0.664, 0.102, 5.717, 0.178, 20.189],
    node: [0.116, 0.127, 0.13, 0.118, 0.249, 0.097, 0.202, 0.125, 0.119],
    e262: [null, null, 14.198, 102.783, 58.3, 8.489, null, 8.438, null]
  };
  var JS = [
    ["FlightPlanner", 14.789, 15.505], ["ai-astar", 10.785, 11.179], ["hash-map", 7.965, 8.199],
    ["earley-boyer", 5.716, 5.994], ["UniPoker", 4.425, 4.555], ["bigint-bigdenary", 4.211, 4.284],
    ["delta-blue", 3.588, 3.955], ["raytrace-private-class-fields", 3.536, 3.516],
    ["octane-code-load", 3.45, 2.3], ["richards", 2.834, 2.973], ["raytrace", 2.771, 3.176],
    ["Box2D", 2.383, 2.562], ["gbemu", 2.14, 2.274], ["crypto", 2.13, 2.609], ["pdfjs", 2.0, 2.009],
    ["navier-stokes", 1.842, 3.16], ["stanford-crypto-aes", 1.764, 1.767],
    ["stanford-crypto-sha256", 1.701, 1.996], ["stanford-crypto-pbkdf2", 1.7, 2.009],
    ["gaussian-blur", 1.695, 2.33], ["json-parse-inspector", 1.128, 1.104],
    ["json-stringify-inspector", 0.957, 0.954]
  ];
  var TIMEOUT = 120;

  function isDark() { return document.documentElement.classList.contains("dark"); }
  function col(k) { return isDark() ? byKey[k].dark : byKey[k].light; }
  function ink() {
    return isDark()
      ? { text: "#E8E6E3", muted: "#9A9590", grid: "#2c2c2a", axis: "#4A4744", surface: "#1A1918" }
      : { text: "#2D2A24", muted: "#6B6860", grid: "#E8E4DC", axis: "#D4CFC4", surface: "#FAF7F2" };
  }
  function hatch(color) {
    var c = document.createElement("canvas");
    c.width = c.height = 8;
    var g = c.getContext("2d");
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 8); g.lineTo(8, 0);
    g.moveTo(-2, 2); g.lineTo(2, -2);
    g.moveTo(6, 10); g.lineTo(10, 6);
    g.stroke();
    return g.createPattern(c, "repeat");
  }
  function fmt(n) { return n.toLocaleString("en-US"); }

  function baseOptions(horizontal) {
    var i = ink();
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: horizontal ? "y" : "x",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: i.surface, titleColor: i.text, bodyColor: i.text,
          borderColor: i.axis, borderWidth: 1
        }
      },
      scales: {}
    };
  }
  function styleScales(chart, gridFns) {
    var i = ink();
    Object.keys(chart.options.scales).forEach(function (id) {
      var s = chart.options.scales[id];
      s.ticks = Object.assign(s.ticks || {}, { color: i.muted });
      s.grid = Object.assign(s.grid || {}, { color: (gridFns && gridFns[id]) || i.grid });
      s.border = { color: i.axis };
      if (s.title) s.title.color = i.muted;
    });
    var t = chart.options.plugins.tooltip;
    t.backgroundColor = i.surface; t.titleColor = i.text; t.bodyColor = i.text; t.borderColor = i.axis;
  }

  function buildFilters(fig, keys, defaults, onChange) {
    var box = fig.querySelector(".jsse-filters");
    var state = {};
    keys.forEach(function (k) {
      state[k] = defaults.indexOf(k) >= 0;
      var label = document.createElement("label");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = state[k];
      input.addEventListener("change", function () { state[k] = input.checked; onChange(state); });
      var sw = document.createElement("span");
      sw.className = "jsse-swatch";
      sw.dataset.k = k;
      sw.style.background = col(k);
      label.appendChild(input);
      label.appendChild(sw);
      label.appendChild(document.createTextNode(byKey[k].name));
      box.appendChild(label);
    });
    return state;
  }

  var charts = [];

  // test262: one bar per visible engine.
  (function () {
    var fig = document.getElementById("chart-t262");
    if (!fig) return;
    var order = ["v09", "bc", "mar", "node", "e262", "boa"];
    var state;
    var valueLabels = {
      id: "valueLabels",
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx, meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.fillStyle = ink().text;
        ctx.font = "12px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        meta.data.forEach(function (bar, idx) {
          var k = chart.data._keys[idx];
          var txt = (k === "e262" ? "≈" : "") + fmt(T262[k].fail);
          ctx.fillText(txt, bar.x + 6, bar.y);
        });
        ctx.restore();
      }
    };
    var opts = baseOptions(true);
    opts.scales = {
      x: { beginAtZero: true, suggestedMax: 17500, title: { display: true, text: "failing scenarios" } },
      y: { grid: { display: false } }
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        var k = c.chart.data._keys[c.dataIndex];
        return fmt(T262[k].fail) + " failing · " + T262[k].note;
      }
    };
    var chart = new Chart(fig.querySelector("canvas"), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, barPercentage: 0.7 }] },
      options: opts,
      plugins: [valueLabels]
    });
    function refresh() {
      var keys = order.filter(function (k) { return state[k]; });
      chart.data._keys = keys;
      chart.data.labels = keys.map(function (k) { return byKey[k].name; });
      chart.data.datasets[0].data = keys.map(function (k) { return T262[k].fail; });
      chart.data.datasets[0].backgroundColor = keys.map(col);
      styleScales(chart);
      chart.update();
    }
    state = buildFilters(fig, ["v09", "mar", "boa", "bc", "node", "e262"], ["v09", "mar", "boa"], refresh);
    chart._refresh = refresh;
    refresh();
    charts.push(chart);
  })();

  // Micro-benchmarks: grouped bars, log scale, hatched bars for timeouts.
  (function () {
    var fig = document.getElementById("chart-micro");
    if (!fig) return;
    var order = ["v09", "mar", "boa", "bc", "node", "e262"];
    var opts = baseOptions(false);
    opts.scales = {
      x: { grid: { display: false } },
      y: { type: "logarithmic", min: 0.05, max: 200, title: { display: true, text: "seconds (log)" },
           ticks: { callback: function (v) { return [0.1, 1, 10, 100].indexOf(v) >= 0 ? v + " s" : ""; } } }
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        var k = order[c.datasetIndex];
        var raw = MICRO[k][c.dataIndex];
        return byKey[k].name + ": " + (raw === null ? "timeout (>120 s)" : raw.toFixed(2) + " s");
      }
    };
    var chart = new Chart(fig.querySelector("canvas"), {
      type: "bar",
      data: {
        labels: BENCHES,
        datasets: order.map(function (k) {
          return {
            label: byKey[k].name,
            data: MICRO[k].map(function (v) { return v === null ? TIMEOUT : v; }),
            borderRadius: 3, borderSkipped: "start", barPercentage: 0.9, categoryPercentage: 0.8
          };
        })
      },
      options: opts
    });
    function refresh(st) {
      order.forEach(function (k, idx) {
        var ds = chart.data.datasets[idx];
        ds.backgroundColor = MICRO[k].map(function (v) { return v === null ? hatch(col(k)) : col(k); });
        chart.setDatasetVisibility(idx, !!st[k]);
      });
      styleScales(chart);
      chart.update();
    }
    var state = buildFilters(fig, order, ["v09", "mar", "boa"], refresh);
    chart._refresh = function () { refresh(state); };
    refresh(state);
    charts.push(chart);
  })();

  // JetStream: floating bars from 1x to the speedup, log scale.
  (function () {
    var fig = document.getElementById("chart-js");
    if (!fig) return;
    var order = ["v09", "bc"];
    var opts = baseOptions(true);
    opts.scales = {
      x: { type: "logarithmic", min: 0.5, max: 20, title: { display: true, text: "speedup over March (log)" },
           ticks: { callback: function (v) { return [0.5, 1, 2, 5, 10, 20].indexOf(v) >= 0 ? v + "x" : ""; } } },
      y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } }
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        var k = order[c.datasetIndex];
        return byKey[k].name + ": " + JS[c.dataIndex][c.datasetIndex + 1].toFixed(2) + "x";
      }
    };
    var chart = new Chart(fig.querySelector("canvas"), {
      type: "bar",
      data: {
        labels: JS.map(function (r) { return r[0]; }),
        datasets: order.map(function (k, idx) {
          return {
            label: byKey[k].name,
            data: JS.map(function (r) { return [1, r[idx + 1]]; }),
            borderRadius: 3, borderSkipped: false, barPercentage: 0.85, categoryPercentage: 0.85
          };
        })
      },
      options: opts
    });
    function refresh(st) {
      order.forEach(function (k, idx) {
        chart.data.datasets[idx].backgroundColor = col(k);
        chart.setDatasetVisibility(idx, !!st[k]);
      });
      styleScales(chart, { x: function (c) { return c.tick && c.tick.value === 1 ? ink().muted : ink().grid; } });
      chart.update();
    }
    var state = buildFilters(fig, order, ["v09"], refresh);
    chart._refresh = function () { refresh(state); };
    refresh(state);
    charts.push(chart);
  })();

  new MutationObserver(function () {
    document.querySelectorAll(".jsse-swatch").forEach(function (sw) { sw.style.background = col(sw.dataset.k); });
    charts.forEach(function (c) { c._refresh(); });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
})();
</script>
{% endraw %}
