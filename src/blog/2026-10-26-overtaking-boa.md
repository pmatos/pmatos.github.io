---
title: "Overtaking Boa"
description: "A month after v0.9.0, JSSE runs the micro-benchmarks about 5x faster, passes all 48 JetStream workloads and beats Boa on every one of the 44 that both engines run. test262 is still at 100%."
tags: ["javascript", "claude", "rust", "agentic-coding", "performance"]
date: 2026-10-26
image: /img/2026/10/jsse-overtaking-boa.png
layout: article.njk
permalink: /blog/2026-10-26-overtaking-boa.html
eleventyExcludeFromCollections: true
robots: noindex, follow
draft: true
comments: true
---

![A small copper robot sprinting ahead of a mechanical boa towards a finish banner, on a track lined with glowing checkmark guardrails](/img/2026/10/jsse-overtaking-boa.png)

JSSE v0.12.0 was tagged on October 26, a month after v0.9.0, so it is time to look at the numbers again. When I [took stock of JSSE](/blog/faster-with-guardrails.html) in September, the last section of that post was called "What's Still Bad", and it listed quadratic arrays, a bytecode VM that barely helped, no hidden classes and a benchmark that timed out. It also showed [Boa](https://github.com/boa-dev/boa) beating JSSE by 2x to 4x on calls, closures and strings.

Boa is the natural yardstick for JSSE. It is a mature JavaScript engine written in Rust which, like JSSE, doesn't JIT, and it has been around for much longer than JSSE has. Therefore, when I say that JSSE overtook it, keep in mind that this is one interpreter against another, on my benchmarks and on one machine, and not a verdict on Boa.

In this post, I will go through what happened in that month. Between v0.9.0 (September 23) and the October 25 checkpoint used for the numbers below, the agents merged 271 commits into JSSE, 84 of which are performance work[^tag]. The short version: on my micro-benchmark suite, JSSE is about **5x faster than v0.9.0** and, while a month ago it was 2.2x slower than Boa 0.22, it is now **2.2x faster**[^eight]. On JetStream 3, it is faster than Boa on all 44 workloads that both engines run. And test262 still passes every one of the 99,911 scenarios.

As before, I haven't written a line of JSSE, so this is a report on the results and not a how-to. Everything here comes from the data that [lives in the repository](https://github.com/pmatos/jsse/tree/main/docs/perf/2026-10-25), including the numbers that are less flattering.

## Still 100%

Let's start with the guardrail that matters the most. At the benchmarked commit, `58606ad1`, I had the agent re-run the whole of test262 (the same checkout as last month) in both execution modes: 99,911 of 99,911 scenarios pass with the default configuration, and 99,911 of 99,911 pass with `--no-bytecode`, with zero regressions against the baseline. Going 5x faster in a month and not losing a single scenario is what the pass-list baseline is for.

## Where the Speed Came From

Did the bytecode VM finally pay off? Yes, and it is now the default. In the last post I explained that entering a compiled function cost about 350 ns, that each op saved only about 22 ns, and that the whole thing broke even at around 16 ops. At v0.9.0, `--bytecode` was only 3.8% better on JetStream (geometric mean). On October 8, [#875](https://github.com/pmatos/jsse/pull/875) flipped the default (it shipped in v0.11.0 the day after), and `--no-bytecode` is now the opt-out. My reading of the pull requests is that two things made it worthwhile: a long list of coverage PRs (generators, async functions and async generators, default and rest parameters, `let` loops, `arguments` objects), so that fewer functions fall back to the tree-walker, and a series of cuts to the cost of calls and frames.

How much of the speedup is bytecode, and how much is everything else? I asked the agent to run the micro suite once more with `--no-bytecode` at the same commit, so that we can split it. This is a separate run from the one in the next section, so its times don't match that section exactly[^noise].

| bench | v0.9.0 (s) | now, `--no-bytecode` (s) | now, default (s) | v0.9.0 → no bytecode | no bytecode → default |
|---|---:|---:|---:|---:|---:|
| fib | 4.011 | 2.022 | 0.944 | 1.98x | 2.14x |
| closures | 5.285 | 2.071 | 1.288 | 2.55x | 1.61x |
| opmix | n/a | 53.123 | 6.904 | n/a | 7.69x |
| string | 1.043 | 0.145 | 0.077 | 7.20x | 1.89x |
| array | 27.540 | 0.269 | 0.154 | 102.5x | 1.74x |
| object | 0.668 | 0.451 | 0.336 | 1.48x | 1.34x |
| loop | 2.093 | 1.233 | 0.575 | 1.70x | 2.14x |
| json | 0.176 | 0.124 | 0.109 | 1.41x | 1.14x |
| regex | 0.104 | 0.077 | 0.067 | 1.35x | 1.14x |
| **geomean** (without opmix) | | | | **3.40x** | **1.60x** |

Over the eight scripts that haven't changed since v0.9.0, about 1.6x of the total (5.4x in this run) comes from the bytecode VM and about 3.4x from everything else[^split]. The split is very uneven, though. The `array` gain is almost entirely non-bytecode work and `string` is mostly non-bytecode, while `fib` and `loop` are roughly half and half. `opmix` is the odd one out: in October the script gained two labeled loops ([#876](https://github.com/pmatos/jsse/pull/876)), so it does more work than it did at v0.9.0, and I leave it out of every comparison with v0.9.0. Within the October run, the bytecode VM makes it 7.7x faster than `--no-bytecode`, the biggest jump in the table.

The rest of the work falls roughly into five groups (all the PR numbers are in the collapsible list below):

- **Bytecode and coverage.** Besides #875, the generators ([#1103](https://github.com/pmatos/jsse/pull/1103)), async functions ([#1148](https://github.com/pmatos/jsse/pull/1148)) and async generators ([#1149](https://github.com/pmatos/jsse/pull/1149)) are now compiled. Each of the last two cut about 30% of the instructions executed on `doxbee-async` and `async-fs`, respectively.
- **Calls and frames.** [#1120](https://github.com/pmatos/jsse/pull/1120) removed 15% of the instructions executed by `fib`, [#1127](https://github.com/pmatos/jsse/pull/1127) removed 44% on default and rest parameters, and [#1134](https://github.com/pmatos/jsse/pull/1134) removed between 26% and 44% on `arguments` objects. Between the October 14 and October 25 runs of the audit I will describe below, the default-parameter controls went from taking 2.0 to 2.2 times as long as Boa to taking 0.78 to 0.91 times as long.
- **Arrays, strings and sorting.** This is the one I promised in the last post. The `array` script went from 27.5 s to 0.18 s, mostly thanks to array work outside the bytecode VM, starting with [#758](https://github.com/pmatos/jsse/pull/758), which made building the result of `map`, `filter` and `slice` linear. Strings got amortized O(1) concatenation ([#945](https://github.com/pmatos/jsse/pull/945)) and inline short strings ([#1099](https://github.com/pmatos/jsse/pull/1099)), `shift` became amortized O(1) ([#1195](https://github.com/pmatos/jsse/pull/1195)), and `Array.prototype.sort` now uses a merge sort that exploits natural runs ([#1193](https://github.com/pmatos/jsse/pull/1193)).
- **Generators, promises and the GC.** Between the same two audits, the generators pipeline went from 1.59x of Boa's time to 0.42x, `lazy-collections` from 2.05x to 0.65x and the deep promise queue from 1.10x to 0.36x. On the GC side, [#1136](https://github.com/pmatos/jsse/pull/1136) removed 42% of the instructions on the deep promise queue and [#1137](https://github.com/pmatos/jsse/pull/1137) removed 24% on Three.js.
- **Everything else.** jemalloc as the allocator ([#1074](https://github.com/pmatos/jsse/pull/1074)), faster property access, BigInt, `Intl` caches, private fields and proxies.

Note that most of the percentages above are instruction counts (callgrind), not seconds. The seconds are in the next section.

<details>
<summary>The performance PRs behind these numbers</summary>

- Bytecode on by default: #875. Coverage: #962, #963, #980 to #984, #1126, #1127 to #1130, #1143, #1144, #1159, #1161. Generators #1103, async functions #1148, async generators #1149.
- Calls and frames: #1088, #1090, #1120, #1121, #1127, #1133, #1134.
- Arrays and sorting: #758, #975, #977, #985, #1193, #1195.
- Strings: #945, #973, #1099.
- Generators, promises and async: #968, #970, #971, #1076, #1083.
- GC: #989, #998, #1080, #1136, #1137.
- Allocator: #1074 (jemalloc, about 6% wall time on six heavy workloads) and #1102 (deferring transparent huge pages, which by its own description fell short of the target).
- Property access: #986, #987, #1123, #1124.
- BigInt: #990, #991, #992, #1128.
- `Intl`: #1140, #1191 (measured on a loaded host, so I am not quoting the numbers).
- Classes, proxies and symbols: #993, #994, #996, #999, #1091, #1097.

</details>

## The Numbers

Let's look at the same nine scripts as last time. Each one is timed as a whole process (startup included), and we take the median of five interleaved runs. This time Boa shows up twice: version 0.22.0, which I used in the last post, and its current `main` (commit `64c209f1`, which still calls itself 0.22.0), so that nobody can say I compared against something stale. Tick the boxes to add or remove engines from the comparison.

{% raw %}
<figure class="jsse-chart" id="chart-micro" data-plate="duel"><div class="jsse-filters" role="group" aria-label="Engines shown"></div><div class="jsse-canvas" style="height:380px"><canvas role="img" aria-label="Micro-benchmark times per engine on a log scale; table below"></canvas></div><figcaption>Micro-benchmarks, median wall-clock seconds, log scale (lower is better).</figcaption></figure>
{% endraw %}

<details>
<summary>Micro-benchmark table (seconds)</summary>

| Benchmark | JSSE v0.9.0 | JSSE now | JSSE now `--no-bytecode` | Boa 0.22.0 | Boa main |
|---|---:|---:|---:|---:|---:|
| fib | 4.011 | 0.941 | 2.022 | 1.199 | 1.207 |
| closures | 5.285 | 1.274 | 2.071 | 2.086 | 1.898 |
| opmix | n/a | 6.930 | 53.123 | 12.716 | 10.864 |
| string | 1.043 | 0.101 | 0.145 | 0.496 | 0.463 |
| array | 27.540 | 0.179 | 0.269 | 0.308 | 0.310 |
| object | 0.668 | 0.364 | 0.451 | 0.546 | 0.527 |
| loop | 2.093 | 0.576 | 1.233 | 1.848 | 1.538 |
| json | 0.176 | 0.108 | 0.124 | 0.313 | 0.308 |
| regex | 0.104 | 0.067 | 0.077 | 0.138 | 0.160 |

</details>

Against v0.9.0, JSSE is 4.3x faster on `fib`, 4.2x on `closures`, 10x on `string` and 154x on `array`, with a geometric mean of about 5x over the eight scripts that haven't changed (the chart leaves out the v0.9.0 `opmix` bar for the same reason). Against Boa 0.22.0, it now wins all nine: the narrowest margin is `fib` (0.78x of Boa's time) and the widest is `string` (0.20x). The geometric mean of the time ratio is 0.47 against Boa 0.22.0 and 0.50 against Boa `main`. Startup, measured with an empty script, is about 16 ms for JSSE and about 30 ms for Boa.

JetStream is again the more realistic set. JSSE passes 48 of 48 workloads (`mandreel`, the one that timed out in the last post, now runs). Boa 0.22.0 and Boa `main` both pass 44, and fail `Basic`, `OfflineAssembler`, `typescript-octane` and `validatorjs`. On the 44 workloads that both engines run, JSSE is faster on every single one. The chart shows the time ratio per workload (JSSE's time divided by Boa's, drawn from 1.0 down to the ratio, so the longer the bar, the bigger the JSSE win)[^jsbaseline].

{% raw %}
<figure class="jsse-chart" id="chart-js" data-plate="duel"><div class="jsse-filters" role="group" aria-label="Boa versions shown"></div><div class="jsse-canvas" style="height:1100px"><canvas role="img" aria-label="JetStream time ratio of JSSE over Boa per workload, log scale; table below"></canvas></div><figcaption>JetStream 3, JSSE time divided by Boa time per workload, log scale (left of 1.0 means JSSE is faster).</figcaption></figure>
{% endraw %}

<details>
<summary>JetStream table (JSSE time / Boa time)</summary>

| Workload | vs Boa 0.22.0 | vs Boa main |
|---|---:|---:|
| json-stringify-inspector | 0.11 | 0.11 |
| multi-inspector-code-load | 0.17 | 0.18 |
| first-inspector-code-load | 0.17 | 0.18 |
| js-tokens | 0.17 | 0.18 |
| regexp-octane | 0.25 | 0.24 |
| doxbee-promise | 0.39 | 0.26 |
| octane-code-load | 0.43 | 0.44 |
| doxbee-async | 0.47 | 0.32 |
| pdfjs | 0.50 | 0.47 |
| ML | 0.53 | 0.52 |
| Air | 0.53 | 0.49 |
| crypto | 0.56 | 0.59 |
| ai-astar | 0.56 | 0.54 |
| async-fs | 0.57 | 0.43 |
| raytrace | 0.57 | 0.60 |
| raytrace-private-class-fields | 0.59 | 0.60 |
| FlightPlanner | 0.60 | 0.49 |
| navier-stokes | 0.61 | 0.63 |
| json-parse-inspector | 0.61 | 0.66 |
| gbemu | 0.62 | 0.60 |
| stanford-crypto-aes | 0.63 | 0.64 |
| earley-boyer | 0.64 | 0.57 |
| raytrace-public-class-fields | 0.65 | 0.66 |
| cdjs | 0.65 | 0.60 |
| stanford-crypto-sha256 | 0.66 | 0.69 |
| Babylon | 0.66 | 0.63 |
| stanford-crypto-pbkdf2 | 0.67 | 0.71 |
| gaussian-blur | 0.69 | 0.67 |
| bigint-noble-bls12-381 | 0.70 | 0.68 |
| bigint-paillier | 0.71 | 0.56 |
| UniPoker | 0.73 | 0.65 |
| bigint-bigdenary | 0.74 | 0.74 |
| delta-blue | 0.75 | 0.77 |
| sync-fs | 0.75 | 0.56 |
| mandreel | 0.76 | 0.76 |
| hash-map | 0.76 | 0.81 |
| lazy-collections | 0.76 | 0.64 |
| Box2D | 0.76 | 0.73 |
| splay | 0.78 | 0.79 |
| proxy-mobx | 0.81 | 0.74 |
| richards | 0.82 | 0.84 |
| bigint-noble-ed25519 | 0.86 | 0.88 |
| proxy-vue | 0.87 | 0.75 |
| bigint-noble-secp256k1 | 0.91 | 0.89 |

</details>

The geometric mean is 0.56 against Boa 0.22.0 (JSSE is about 1.8x faster) and 0.53 against Boa `main` (about 1.9x). The biggest wins are `json-stringify-inspector` at 0.11 (the benchmark that regressed in the last post, which is now about 9x faster than Boa) and the inspector and `js-tokens` workloads at 0.17 or 0.18.

The third set of numbers is a 343-case audit that the agent runs against Boa `main`. It combines JSSE's own benchmark scripts and diagnostics, Boa's own benchmark scripts, JetStream workloads and paired control micro-benchmarks written for the audit. Of the 343 cases, 328 run on both engines. Compared with the previous audit of October 14, the geometric mean of JSSE over Boa went from 0.75 to 0.56, the number of cases where JSSE is more than 5% slower went from 93 to 14, and the number where it is more than 30% slower went from 38 to 5[^audit]. A suite of 61 short scripts, each exercising one language or library feature in a loop, agrees: JSSE is faster than Boa 0.22.0 on 49 of the 61 and faster than Boa `main` on 53.

## Where Boa Still Wins

None of this means JSSE is faster than Boa at everything. The 14 audit cases that are still more than 5% slower than Boa `main` fall into four groups:

- `bigint_compare_numeric_control` (1.89x Boa's time), `script_let_loop` (1.82x), `bigint_compare` (1.60x) and a few more, mostly top-level script loops over global lexical bindings. These are tracked in [#1210](https://github.com/pmatos/jsse/issues/1210).
- Closure creation (`closures/create`, 1.42x), tracked in [#1211](https://github.com/pmatos/jsse/issues/1211).
- Getter and setter calls (about 1.2x on the proxy case), tracked in [#1212](https://github.com/pmatos/jsse/issues/1212).
- `strings/slice` (1.33x). It is a curious one: JSSE executes *fewer* instructions than Boa (529M against 652M), and which engine wins the wall-clock race depends on the CPU, so I believe it is a memory-system effect and not a real gap.

On JetStream, the narrowest wins are `bigint-noble-secp256k1` (0.91), `proxy-vue` (0.87), `bigint-noble-ed25519` (0.86) and `richards` (0.82). The margin also depends on bytecode: with `--no-bytecode`, JSSE is only about 1.16x faster than Boa 0.22 over all nine micro scripts (geometric mean 0.865), and it is slower on `opmix` (4.2x) and `fib` (1.7x). And hidden classes still haven't landed: there are per-site slot hints and cached property order, but no hidden-class transitions. Boa, for comparison, has had hidden classes since v0.17.

## What's Next

The audit gaps are collected in the epic [#1213](https://github.com/pmatos/jsse/issues/1213), which is the next target. After that, I would like to look at real shapes.

All the numbers come from [`docs/perf/2026-10-25`](https://github.com/pmatos/jsse/tree/main/docs/perf/2026-10-25) and [`docs/perf/2026-10-25-no-bytecode`](https://github.com/pmatos/jsse/tree/main/docs/perf/2026-10-25-no-bytecode)[^method].

## Corrections or Comments?

Comments are open below. As usual, I am happy to receive corrections, and if you spot something odd in the numbers, [open an issue](https://github.com/pmatos/jsse/issues/new) on JSSE.

[^tag]: The numbers were measured at commit `58606ad1`. v0.12.0 adds one engine change on top of it, a refactor of the `some`/`every` traversals ([#1208](https://github.com/pmatos/jsse/pull/1208)), which my numbers don't cover. The rest of the engine is identical.

[^split]: This split measures the bytecode VM on top of the improved tree-walker. It is one reasonable way of decomposing the speedup, not the only one.

[^jsbaseline]: I don't quote a JetStream speedup over v0.9.0. The runner changed between the September and October runs, and I can't be sure the scores are on the same scale.

[^audit]: The previous audit ran on a different host with background load, so only the ratios of the two runs are comparable and not the absolute times.

[^eight]: Both figures are over the eight micro scripts that haven't changed since v0.9.0. `bench_opmix` gained two loops in October, which I explain below.

[^noise]: Scripts that run for more than a second repeat to within about 1%, but scripts under half a second moved by up to about 20% between separate runs of the same binary, so treat differences of a few tens of milliseconds on those as noise.

[^method]: Everything ran on a shared build machine (buildbox3). The micro-benchmarks are the median of five runs, with JSSE and Boa interleaved, and the load stayed at or below about 1.65. JetStream uses `--iterations 1` with a pinned JetStream commit, and each workload is the median of three runs, with JSSE and Boa run one after the other and without a load gate. The v0.9.0 column was measured on September 25 on the same machine, as the median of five runs that were not interleaved, with the load gate checked only once, and the load reached about 3 during that run. The same Boa 0.22.0 release ran about 8% slower in that September session than in October, so if JSSE was slowed down by the same amount, the speedups over v0.9.0 are overstated by up to about 10% (5.1x would be closer to 4.6x). The comparisons with Boa within each run are not affected in the same way. `bench_opmix` gained two loops in October, so the speedups over v0.9.0 use the other eight scripts, whereas the comparisons with Boa use all nine, since both engines ran the same script within each run. The headline "about 5x" covers both the 5.1x of the checkpoint run and the 5.4x of the `--no-bytecode` run.

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
    { k: "old", name: "JSSE v0.9.0", light: "#eb6834", dark: "#d95926" },
    { k: "now", name: "JSSE now", light: "#2a78d6", dark: "#3987e5" },
    { k: "nobc", name: "JSSE now --no-bytecode", light: "#eda100", dark: "#c98500" },
    { k: "b22", name: "Boa 0.22.0", light: "#1baf7a", dark: "#199e70" },
    { k: "bhead", name: "Boa main", light: "#8a6fd6", dark: "#7a5fc6" }
  ];
  var byKey = {};
  ENGINES.forEach(function (e) { byKey[e.k] = e; });

  var BENCHES = ["fib", "closures", "opmix", "string", "array", "object", "loop", "json", "regex"];
  var MICRO = {"old": [4.011, 5.285, null, 1.043, 27.54, 0.668, 2.093, 0.176, 0.104], "nobc": [2.022, 2.071, 53.123, 0.145, 0.269, 0.451, 1.233, 0.124, 0.077], "now": [0.941, 1.274, 6.93, 0.101, 0.179, 0.364, 0.576, 0.108, 0.067], "b22": [1.199, 2.086, 12.716, 0.496, 0.308, 0.546, 1.848, 0.313, 0.138], "bhead": [1.207, 1.898, 10.864, 0.463, 0.31, 0.527, 1.538, 0.308, 0.16]};
  var JS = [["json-stringify-inspector", 0.11, 0.11], ["multi-inspector-code-load", 0.17, 0.18], ["first-inspector-code-load", 0.17, 0.18], ["js-tokens", 0.17, 0.18], ["regexp-octane", 0.25, 0.24], ["doxbee-promise", 0.39, 0.26], ["octane-code-load", 0.43, 0.44], ["doxbee-async", 0.47, 0.32], ["pdfjs", 0.5, 0.47], ["ML", 0.53, 0.52], ["Air", 0.53, 0.49], ["crypto", 0.56, 0.59], ["ai-astar", 0.56, 0.54], ["async-fs", 0.57, 0.43], ["raytrace", 0.57, 0.6], ["raytrace-private-class-fields", 0.59, 0.6], ["FlightPlanner", 0.6, 0.49], ["navier-stokes", 0.61, 0.63], ["json-parse-inspector", 0.61, 0.66], ["gbemu", 0.62, 0.6], ["stanford-crypto-aes", 0.63, 0.64], ["earley-boyer", 0.64, 0.57], ["raytrace-public-class-fields", 0.65, 0.66], ["cdjs", 0.65, 0.6], ["stanford-crypto-sha256", 0.66, 0.69], ["Babylon", 0.66, 0.63], ["stanford-crypto-pbkdf2", 0.67, 0.71], ["gaussian-blur", 0.69, 0.67], ["bigint-noble-bls12-381", 0.7, 0.68], ["bigint-paillier", 0.71, 0.56], ["UniPoker", 0.73, 0.65], ["bigint-bigdenary", 0.74, 0.74], ["delta-blue", 0.75, 0.77], ["sync-fs", 0.75, 0.56], ["mandreel", 0.76, 0.76], ["hash-map", 0.76, 0.81], ["lazy-collections", 0.76, 0.64], ["Box2D", 0.76, 0.73], ["splay", 0.78, 0.79], ["proxy-mobx", 0.81, 0.74], ["richards", 0.82, 0.84], ["bigint-noble-ed25519", 0.86, 0.88], ["proxy-vue", 0.87, 0.75], ["bigint-noble-secp256k1", 0.91, 0.89]];

  function isDark() { return document.documentElement.classList.contains("dark"); }
  function col(k) { return isDark() ? byKey[k].dark : byKey[k].light; }
  function ink() {
    return isDark()
      ? { text: "#E8E6E3", muted: "#9A9590", grid: "#2c2c2a", axis: "#4A4744", surface: "#1A1918" }
      : { text: "#2D2A24", muted: "#6B6860", grid: "#E8E4DC", axis: "#D4CFC4", surface: "#FAF7F2" };
  }

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

  // Micro-benchmarks: grouped bars, log scale.
  (function () {
    var fig = document.getElementById("chart-micro");
    if (!fig) return;
    var order = ["old", "now", "nobc", "b22", "bhead"];
    var opts = baseOptions(false);
    opts.scales = {
      x: { grid: { display: false } },
      y: { type: "logarithmic", min: 0.05, max: 100, title: { display: true, text: "seconds (log)" },
           ticks: { callback: function (v) { return [0.1, 1, 10, 100].indexOf(v) >= 0 ? v + " s" : ""; } } }
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        var k = order[c.datasetIndex];
        var v = MICRO[k][c.dataIndex];
        return byKey[k].name + ": " + (v === null ? "different script" : v.toFixed(2) + " s");
      }
    };
    var chart = new Chart(fig.querySelector("canvas"), {
      type: "bar",
      data: {
        labels: BENCHES,
        datasets: order.map(function (k) {
          return {
            label: byKey[k].name,
            data: MICRO[k],
            borderRadius: 3, borderSkipped: "start", barPercentage: 0.9, categoryPercentage: 0.8
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
      styleScales(chart);
      chart.update();
    }
    var state = buildFilters(fig, order, ["old", "now", "b22"], refresh);
    chart._refresh = function () { refresh(state); };
    refresh(state);
    charts.push(chart);
  })();

  // JetStream: floating bars from the ratio up to 1.0, log scale.
  (function () {
    var fig = document.getElementById("chart-js");
    if (!fig) return;
    var order = ["b22", "bhead"];
    var opts = baseOptions(true);
    opts.scales = {
      x: { type: "logarithmic", min: 0.08, max: 1.2, title: { display: true, text: "JSSE time / Boa time (log)" },
           ticks: { callback: function (v) { return [0.1, 0.2, 0.5, 1].indexOf(v) >= 0 ? v : ""; } } },
      y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } }
    };
    opts.plugins.tooltip.callbacks = {
      label: function (c) {
        var k = order[c.datasetIndex];
        var r = JS[c.dataIndex][c.datasetIndex + 1];
        return byKey[k].name + ": " + r.toFixed(2) + " (JSSE " + (1 / r).toFixed(1) + "x faster)";
      }
    };
    var chart = new Chart(fig.querySelector("canvas"), {
      type: "bar",
      data: {
        labels: JS.map(function (r) { return r[0]; }),
        datasets: order.map(function (k, idx) {
          return {
            label: byKey[k].name,
            data: JS.map(function (r) { return [r[idx + 1], 1]; }),
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
    var state = buildFilters(fig, order, ["b22"], refresh);
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
