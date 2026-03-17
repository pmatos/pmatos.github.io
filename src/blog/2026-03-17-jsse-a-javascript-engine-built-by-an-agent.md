---
title: "JSSE: A JavaScript Engine Built by an Agent"
description: "JSSE is the first JavaScript engine to pass 100% of test262 non-staging tests. 136,000 lines of Rust. Zero lines written by me."
tags: ["javascript", "claude", "agents", "rust", "genai"]
date: 2026-03-17
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
eleventyExcludeFromCollections: true
---

![An agent dreaming in JavaScript](/img/2026/03/jsse-agent-dreaming.png)

In January, I came across a blog post by the author of [one-agent-one-browser](https://emsh.cat/one-human-one-agent-one-browser/) — a from-scratch browser built in Rust by a single person directing a single coding agent over a few days. No JavaScript support, though. I read it and thought: "How hard can it be to build a JavaScript engine the same way?"

Six weeks later, [JSSE](https://github.com/pmatos/jsse) (JavaScript Simple Engine) became the first JavaScript engine I know of to pass 100% of [test262](https://github.com/tc39/test262) non-staging tests — all 98,426 scenarios across `language/`, `built-ins/`, `annexB/`, and `intl402/`. Not V8. Not SpiderMonkey. Not JavaScriptCore. A from-scratch engine in Rust, built entirely by [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) running in YOLO mode.

I didn't write a single line of Rust. Not one. The repository is a write-only data store from my perspective. I didn't even create the GitHub repo by hand — the agent did that too.

## The Numbers

| Metric | Value |
|--------|-------|
| Start date | January 27, 2026 |
| 100% non-staging test262 | March 9, 2026 (42 days) |
| Total commits | 592 |
| Hand-written Rust | ~136,000 lines |
| Total Rust (incl. generated Unicode tables) | ~170,000 lines |
| Lines added (all time) | 929,475 |
| Lines removed (all time) | 448,317 |
| My hands-on-keyboard time | ~4 hours total |

That last number is the one that surprises people. Four hours spread across six weeks — 30 seconds here, two minutes there. The rest was the agent working autonomously.

## How It Was Built

The setup was deliberately vanilla. Claude Code running in YOLO mode (auto-accept all tool use). No fancy orchestration. The plugins I used were:

- **`/simplify`** — used maybe once or twice when files got too large and needed refactoring
- **`ralph-wiggum-loop`** — the built-in autonomous loop plugin. I started with this but found it would get lost after a while, possibly due to context not clearing properly between iterations
- **[chiefloop.com](https://chiefloop.com)** — an external tool for running Claude Code overnight. Useful for long unattended runs, though it was missing some things from my usual workflow

The workflow that worked best was simple: I'd prompt Claude to plan the next feature, auto-accept the plan, let it implement, and let it run the tests. `CLAUDE.md` had all the rules — no regressions allowed, always attempt to pass more tests than before. Then I'd come back, check the test262 numbers, and kick off the next feature.

The longest successful unattended loop was 16 hours for the Temporal API implementation. I kicked it off before bed and came back to a full implementation of `Instant`, `ZonedDateTime`, `PlainDateTime`, `PlainDate`, `PlainTime`, `Duration`, `Temporal.Now`, IANA timezone support via ICU4X, and 12 calendar systems — 4,482 test262 tests passing. Temporal is one of the largest and most complex proposals in recent ECMAScript history, and the agent handled it in a single overnight session.

## The Pass Rate Curve

![JSSE Test262 Pass Rate](/img/2026/03/jsse_passrate.png)

The chart tells the story better than I can. A few milestones worth calling out:

| Date | Rate | What happened |
|------|------|---------------|
| Jan 27 | 26% | Project kickoff — lexer, parser, basic interpreter |
| Jan 31 | 51% | String.prototype wiring bug fix exposed ~11k tests (+23% in a single day) |
| Feb 3 | 63% | Generators via state machine approach |
| Feb 10 | 86% | Temporal API phase 1 |
| Feb 13 | 88% | Full suite expansion — added intl402, test count nearly doubled (~48k → ~92k), pass rate still went *up* |
| Feb 22 | 95% | SharedArrayBuffer + Atomics (868 new passes in one day) |
| Mar 5 | 99.6% | Massive parser early-errors batch (274 fixes) |
| Mar 9 | **100%** | `Array.fromAsync` was the final fix |

The Jan 31 jump is my favorite. A single bug fix in how `String.prototype` was wired up unblocked about 11,000 tests overnight. That's the kind of thing where having the full test262 suite as your feedback signal is invaluable — you find bugs by their blast radius.

## Engine Comparison

I ran the same test262 suite against Node.js and Boa (another Rust-based JS engine) for comparison. Same checkout, same harness, same timeout, same machine (128-core):

| Engine | Version | Scenarios | Pass | Fail | Rate |
|--------|---------|-----------|------|------|------|
| **JSSE** | latest | 101,234 | 101,044 | 190 | **99.81%** |
| **Boa** | v0.21 | 91,986 | 83,260 | 8,726 | **90.51%** |
| **Node** | v25.8.0 | 91,986 | 79,201 | 11,986 | **86.86%** |

Some important caveats: Node's failures are dominated by Temporal (not shipped in Node 25 — that's 8,980 of its 11,986 failures). Module tests (799 scenarios) are skipped for Node because the test adapter can't run ES modules through it. Boa's main gaps are parser-level (assignment target validation, class destructuring, RegExp property escapes). These are mature, production-quality engines being compared on a metric they weren't specifically optimizing for, so take the comparison for what it is.

JSSE's scenario count is higher (101,234 vs 91,986) because it includes the full staging test suite. On non-staging tests, JSSE is at a flat 100%.

I also ran JSSE against the [acorn](https://github.com/acornjs/acorn) test suite as a real-world sanity check beyond test262. All 13,507 acorn tests pass.

## A Note on Staging Tests

At one point I thought JSSE was passing staging tests too. It wasn't — `run-test262.py` wasn't actually running them. When I finally ran the staging suite explicitly, things got interesting.

The non-staging suite is well-maintained and internally consistent. Staging is where proposed tests live before promotion, and it shows. JSSE currently passes 2,762 of 2,808 staging scenarios (98.36%). The remaining failures fall into three categories: flaky timeouts, `libm` precision gaps, and — most interestingly — what appear to be bugs in the test suite itself.

For example, [six staging tests](https://github.com/pmatos/jsse/issues/31) use a shared harness function that relies on `eval`-declared variables leaking into the enclosing scope, which strict mode explicitly prevents. These tests fail on both JSSE and Node. They need a `noStrict` flag upstream. Another case: [two staging tests](https://github.com/pmatos/jsse/issues/36) expect AnnexB hoisting behavior for block-scoped `function arguments()` declarations that directly contradicts a main-suite test. The main suite reflects a recent spec change that no major engine has implemented yet — JSSE follows the spec, so the main-suite test passes and the staging tests fail.

When the test suite you're targeting starts testing *you* back, that's a good sign.

## What About Performance?

Bad. Intentionally so — zero effort was spent on optimization. JSSE is a pure tree-walking interpreter with no bytecode compilation. Here are some microbenchmarks against Node (V8) and Boa:

| Benchmark | Node v18 | Boa v0.21 | JSSE v0.1 | JSSE vs Node |
|-----------|----------|-----------|-----------|--------------|
| loop | 0.18s | 2.02s | 2.90s | 16x |
| fib | 0.21s | 2.53s | 28.57s | 136x |
| string | 0.19s | 0.62s | 4.74s | 25x |
| array | 0.17s | 0.53s | 119.45s | 703x |
| object | 0.35s | 0.69s | 0.85s | 2.4x |
| regex | 0.16s | 0.24s | 5.62s | 35x |
| closures | 0.18s | 2.79s | 15.48s | 86x |
| json | 0.20s | 0.44s | 0.25s | 1.2x |

The range is enormous — from 1.2x (JSON, where JSSE actually beats Boa) to 703x (array operations). The `fib` benchmark is recursive Fibonacci, which hammers function call overhead — 136x is exactly what you'd expect from a tree-walker that re-traverses the AST on every call. The array benchmark is the worst case, likely hitting a pathological path in the array prototype implementation.

Comparing against Boa is more fair since both are interpreters in Rust. JSSE is roughly 1.2x to 225x slower than Boa depending on the benchmark. Object operations and JSON are actually competitive.

![Slowdown relative to Node.js](/img/2026/03/benchmark_slowdown.png)

The test262 suite itself reveals where the pain is. All 30 of the slowest tests are RegExp Unicode property escape tests (`\p{...}`), each taking 64–84 seconds. The slowest — `Script_Extensions_-_Sharada.js` — hits 84 seconds. These tests compile and run regexes that enumerate thousands of Unicode codepoints, and the bottleneck is byte-level WTF-8 regex matching for Unicode property classes. Out of 198,258 total test scenarios, 900 take over 10 seconds and 1,062 take over 1 second. Everything else finishes fast — the long tail is almost entirely regex.

This is fine. Correctness was the only goal. Performance is the obvious next step.

## The Cost

I used a Claude Code Max 20x subscription for this project, so I didn't pay per-token. But `ccusage` tracks what the equivalent API cost would have been, and the number is interesting for context: **$4,618.94** across 302 sessions over 47 days. The breakdown by model:

| Model | Cost (API equivalent) | Share |
|-------|------|-------|
| Claude Opus 4.6 | $4,062.91 | 88% |
| Claude Sonnet 4.6 | $345.54 | 7.5% |
| Claude Haiku 4.5 | $124.83 | 2.7% |
| Claude Sonnet 4.5 | $45.56 | 1% |
| Claude Opus 4.5 | $40.11 | 0.9% |

Opus 4.6 did the vast majority of the heavy lifting. Haiku was used for background tasks like subagent searches. The total token count was about 8.9 billion, but aggressive prompt caching kept costs manageable — cache read tokens alone were 8.8 billion.

To put it in perspective: $4,619 in API-equivalent cost for a 136,000-line Rust codebase that passes 100% of test262. That's roughly $0.03 per line of code, or about $47 per percentage point of test262 compliance.

## What I Learned

**Understanding the plan matters more than writing the code.** The single most important thing I did was ensure Claude had a high-level plan that covered the full path from start to finish. What are the major features? What order should they be implemented in? What are the architectural decisions that will be hard to change later? Agents will develop in a generic way unless told otherwise, and imbuing the development with domain knowledge is critical. I'm fairly confident this project would have taken half the time if I had invested more upfront in researching the architecture — things like how to handle generators (state machines vs. coroutines), how to structure the GC, how to deal with WTF-8 strings.

**test262 is an incredible feedback signal.** Having a comprehensive, well-structured test suite that the agent can run autonomously is what makes this kind of project possible. The agent doesn't need to understand JavaScript semantics deeply — it needs to make the number go up while not making it go down. test262 provides exactly that signal.

**Agents get lost in long contexts.** The `ralph-wiggum-loop` plugin didn't work as well as I hoped, possibly because the context wasn't being cleared properly between iterations. Starting fresh Claude sessions with a new prompt for each feature worked much better than letting it run indefinitely. The sweet spot seemed to be: plan a feature, implement it, run tests, stop. Repeat.

**Re-architecture is expensive but not catastrophic.** There was a point where Claude realized the architecture wasn't right for async functions and had to go back and restructure things. It took longer than it should have, but it worked. A human architect who understood the problem space would have avoided this — which circles back to the first point.

**Rust is good for agentic coding.** I chose Rust explicitly because I believe it's currently the best language for agent-driven development. The type system and compiler catch a massive class of bugs before runtime, which means the agent spends less time debugging and more time making forward progress. The strict compiler is essentially a second feedback signal alongside test262.

## What's Next

Performance. The engine is a pure tree-walker — the lowest-hanging fruit is bytecode compilation and a simple VM. There's probably 10-100x to be gained just from eliminating repeated AST traversal. Beyond that, inline caches, hidden classes, and eventually JIT compilation if I want to get serious.

But honestly, the point of JSSE was never to build a production JavaScript engine. It was to explore what's possible with current agentic coding tools, and to learn about agent workflows in the process. On both counts, I'm satisfied with the result.

The code is at [github.com/pmatos/jsse](https://github.com/pmatos/jsse). MIT licensed. If you want to run test262 yourself, the README has full reproduction instructions.
