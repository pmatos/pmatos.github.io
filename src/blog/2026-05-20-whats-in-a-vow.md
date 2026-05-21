---
title: "What's in a vow? A language for the future of agentic coding"
description: "Announcing Vow, an agent-first programming language with formal verification built in. Self-hosted, early, and open for you to try."
tags: ["vow", "programming-languages", "formal-verification", "agentic-coding"]
date: 2026-05-20
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
comments: true
---

![A human and a machine exchanging an illuminated parchment of proofs across a table](/img/2026/05/vow-pact.png)

Something has been forming in the last few months. A small but distinct category of programming languages is appearing, aimed not at the humans writing the code but at the agents writing most of it. They agree on the diagnosis: agents are good at producing code and are increasingly bad to trust with it as the surface area grows, and the language itself should help. They diverge on the cure.

This is one of them. [Vow](https://vow-lang.com) is a small, statically typed systems language whose programs carry machine-checked *vows*: preconditions, postconditions, and invariants verified by [ESBMC](https://esbmc.org/) bounded model checking before the code ships. The compiler is written in Vow. The verification side, which is the whole point, still needs hardening, and that's the work of the coming months. I'm announcing it now because the moment is here and there is more value in planting a flag than in waiting until everything is polished. The repo is at [github.com/vow-lang/vow](https://github.com/vow-lang/vow).

Here's a SAT solver written in Vow, compiled by Vow, solving a few DIMACS formulas:

<script src="https://asciinema.org/a/pIpGirOXijgVAB7K.js" id="asciicast-pIpGirOXijgVAB7K" async="true"></script>

That binary is the language doing its job. You did not need to look at any Vow source to understand what just happened. That is on purpose.

## How we got here

Since about mid-2025 I had been thinking about languages for agents. Why should it be the case that a language designed for humans is the right one when agents are doing most of the coding? And how do we get to the point where agents are not only writing code but reviewing their own, without the human having to read every diff? The human really just wants the product, plus an assurance that the product fits within some expected operating rules.

A colleague pointed me at [MoonBit](https://www.moonbitlang.com/). I experimented with it by building a small R5RS Scheme interpreter in it, [*moonscheme*](https://github.com/pmatos/moonscheme). It was an interesting experience but it lacked something I felt was essential: built-in automatic verification. Nine months ago, I started a project I called VAL (Verified Agent Language), initially designed to piggy-back on Lean 4.

The design changed considerably over the next half year. Three months ago I read Armin Ronacher's [*A language for agents*](https://lucumr.pocoo.org/2026/2/9/a-language-for-agents/) and decided to drop the Lean 4 dependency, go the Rust route for the first version with [Cranelift](https://cranelift.dev/) as the codegen backend, and ship a prototype. The design sketch became the [design document](https://github.com/vow-lang/vow/blob/main/docs/vow_design.md), the project was renamed, and the first commit landed on February 25, almost three months ago.

The renaming was deliberate. I wrote this around the time of the rename:

> The name reflects the idea: every module makes vows (verifiable guarantees) about its behaviour. The language is deliberately small, designed so an agent can generate it reliably and a human never needs to read the implementation, only the vows.

That sentence is the thesis of the project.

## What Vow is for

The home page says it more directly than I can:

> The syntax is not for you.  
> The semantics is not for you.  
> The language is not for you.  
> Yours is only the product.

That is not modesty. It is the design constraint. If the language is for agents, then nothing about it should optimise for human terseness, human ergonomics, or human taste. What humans get, and *all* humans get, is the product, plus the vow that the product behaves a certain way. Everything else is mechanical.

That puts verification in a load-bearing position. Tests sample behaviour. Reviews sample attention. Neither scales to an agent producing thousands of lines a day across hundreds of repos. A verifier is what scales, because it answers a different question: not *did this case work*, but *does this property hold for all inputs in the contract*. Vow is built around that idea from the ground up.

The vow itself, the thing the human or the agent on the other side of an API reads, looks like this:

```vow
fn divide(x: i64, y: i64) -> i64 vow {
    requires: y != 0,
    ensures:  result == x / y
} { x / y }
```

That is the user-facing surface. The `requires` clause is a precondition: the caller must satisfy it, and the verifier blames them if they don't. The `ensures` clause is a postcondition: the callee must satisfy it, and the verifier blames the implementation if it doesn't. Loop invariants get the same treatment. At build time, these are lowered into obligations for ESBMC. In debug builds, they are also compiled into runtime checks. The contract is the interface; the implementation is the agent's job. A complete runnable version of this example lives at [`examples/divide.vow`](https://github.com/vow-lang/vow/blob/main/examples/divide.vow).

The language behind the contract is intentionally narrow. No user-defined generics. No traits or interfaces. No closures or higher-order functions. A small closed set of intrinsic built-ins (`Option`, `Result`, `Vec`, `HashMap`, `String`), and that's it. Effects are explicit and tracked: `[io]`, `[read]`, `[write]`, `[panic]`, `[unsafe]`. If a function has no effect annotation it is pure. The compiler canonicalises source form so there is one preferred way to write everything, which is doing the agent a favour and incidentally doing humans one too. Most of the choices that make modern languages comfortable for humans are absent because they make the verifier harder to scale or the behaviour harder for an agent to predict locally. The [design document](https://github.com/vow-lang/vow/blob/main/docs/vow_design.md) explains each cut.

## What's actually built

The numbers and artefacts that exist today:

- **Self-host.** The Vow compiler is written in Vow. Thirteen modules, building itself. The Rust compiler in the repo (`./target/release/vow`) is the stage-0 bootstrap; day-to-day development uses `build/vowc`, which is Vow compiling Vow.
- **A SAT solver.** A deterministic CDCL solver with watched literals, first-UIP learning, non-chronological backtracking, phase saving, Luby restarts, and learned-clause cleanup. The whole thing is in Vow, reads DIMACS from a file or stdin, and is the demo you saw above.
- **A chess engine.** A working UCI engine in Vow, sitting alongside the SAT solver in [`examples/`](https://github.com/vow-lang/vow/tree/main/examples). It is not demoed here, but it is there to poke at.
- **A Lean 4 proof checker.** [vow-lean-kernel](https://github.com/pmatos/vow-lean-kernel) is a Lean 4 kernel written in Vow, targeting the [Lean Kernel Arena](https://arena.lean-lang.org/). It is the first large project written in Vow that lives outside the compiler tree, and it is also a small piece of personal arc: the original plan was to build Vow *on top of* Lean. Now there is a Lean kernel built *in* Vow.
- **A Claude Code skill that ships in the compiler binary.** When you run `vowc build` inside a project that has a `.claude/` directory, the compiler writes a skill into `.claude/skills/vow/`. The skill is the canonical reference an agent needs to work with Vow (grammar, error catalogue, diagnostic JSON schemas, the verify-and-fix workflow), and because it is generated from the compiler version you are running, it cannot drift. For non-Claude harnesses, `vowc skill print --bundle` emits the same content as a single document you can paste into a system prompt.
- **Structured diagnostics.** Every diagnostic the compiler produces is structured JSON. Verification failures carry concrete counterexamples and blame metadata so the agent reading them knows what input violates the contract and which side (caller or callee) to blame.

None of that is the language being *good*. It is the language being *real* enough that you can pick it up and try it.

## Where it is today

Honest accounting, because there are real holes:

- **Self-host: yes.** Vow compiles Vow today.
- **Backend: Cranelift via a small FFI shim.** Host-target only. There is no WASM backend and no cross-compilation story yet. The C emitter exists, but only because the ESBMC verification pipeline needs it.
- **Verification of the compiler itself: not done.** This is the obvious gap. The compiler is written in Vow but its own vows are not all verified end-to-end. Closing that loop is the single most important piece of work ahead.
- **Standard library: partial, with partial contracts.** The pieces that exist (`math`, `heap`) carry vows where they are stable; everything else is still moving.
- **Verification coverage of user code: not yet trustworthy enough to bet on.** ESBMC integration is in place and discharges contracts for the example programs, but the corners are still being found. Treat green verification today as "promising," not "settled."
- **Documentation: the design document is the authoritative source.** There is no full language specification yet.
- **Platforms: Linux is the primary target.** macOS and Windows are not currently exercised.

If you read all of that and thought "this is early," you read it right. That is exactly why this post exists today rather than in six months.

## Where it's going

The next stretch of work, roughly in order:

- Tighter ESBMC integration so more contracts discharge cleanly without manual hints.
- A stronger verify → counterexample → fix loop, including better counterexample shapes for the agent on the other end.
- Real benchmarking, both for the verifier and for the generated code.
- More agent-facing tooling around debugging and performance analysis.
- A bigger, more contract-rich standard library.
- The thousand small rough edges you only find by using the thing.
- Proper testing on macOS and Windows.

## Try it

The on-thesis path is: point your agent at [vow-lang.com](https://vow-lang.com) and tell it to install the toolchain and the skill. The agent reads the page, sets up `vowc`, drops the Claude Code skill into your project, and from then on writing and verifying Vow is its problem rather than yours.

If you still want to drive it yourself, the same two commands are on the home page:

```bash
curl -fsSL https://vow-lang.com/install.sh | bash
npx skills install vow-lang/vow
```

The first installs the `vowc` compiler. The second installs the Claude Code skill so any agent in the project gets the canonical, version-locked Vow reference.

## Help

Help is genuinely appreciated. Not from you, though. From your agents. Open an issue if you want to suggest a feature, and bring your arguments to the [discussions](https://github.com/vow-lang/vow/discussions). The repo is at [github.com/vow-lang/vow](https://github.com/vow-lang/vow), the home page at [vow-lang.com](https://vow-lang.com), and the design document, which is the place to start if you want to argue with any of the decisions above, is in [`docs/vow_design.md`](https://github.com/vow-lang/vow/blob/main/docs/vow_design.md).

A new category of language is forming. This is mine. Give it a go.
