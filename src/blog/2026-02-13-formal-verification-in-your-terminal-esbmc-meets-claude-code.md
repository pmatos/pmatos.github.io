---
title: "Formal Verification in Your Terminal: ESBMC meets Claude Code"
description: "A new Claude Code plugin brings ESBMC bounded model checking directly into your AI-assisted development workflow."
tags: ["esbmc", "claude", "formal-verification", "genai"]
date: 2026-02-13
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

[ESBMC](https://esbmc.org/) is an open-source bounded model checker for C, C++, Python, Solidity, and CUDA. Unlike traditional testing, which only explores the paths you think to test, bounded model checking exhaustively explores all execution paths up to a given bound and produces mathematically verified counterexamples when it finds a bug. It's a powerful technique that catches bugs no amount of unit testing would find.

[Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) is Anthropic's agentic coding assistant that lives in your terminal. It supports a plugin system that lets third-party tools integrate deeply into the AI workflow through custom slash commands and skills.

A new [Claude Code plugin for ESBMC](https://github.com/esbmc/esbmc/commit/4b79ba4), now part of ESBMC upstream, bridges the two. Let me show you what that looks like.

## Setup

You need ESBMC installed and available somewhere on your system (the plugin will find it). Then install the plugin:

```
$ claude
> /install-plugin esbmc/esbmc//claude-plugin
```

Restart Claude Code and you're ready to go.

## How It Works

The plugin provides two slash commands -- `/verify` for quick checks and `/audit` for comprehensive multi-pass security audits -- but you don't actually need to use them. The plugin registers a *skill* that Claude activates automatically when you mention anything related to verification: "check this code for bugs", "find memory leaks", "prove correctness", "detect buffer overflows", and so on. Just talk to Claude naturally and it will reach for ESBMC when appropriate.

Under the hood, the skill carries extensive reference material: CLI options, verification strategies, language-specific features, and ESBMC's intrinsics API. This means Claude knows how to pick the right solver, set appropriate unwind bounds, use k-induction for unbounded proofs, and even add `__ESBMC_assume` / `__ESBMC_assert` annotations to your source code when needed. You get the full power of a formal verification tool without having to memorize its command-line interface.

## A Quick Demo

<script src="https://asciinema.org/a/VO4lFSXM8pje8oB8.js" id="asciicast-VO4lFSXM8pje8oB8" async="true"></script>

Consider this small C program ([gist](https://gist.github.com/pmatos/a01a86770caf0252bfb490608a4ec2dd)):

```c
#include <stdlib.h>

int main() {
    int buf[10];

    for (int i = 0; i <= 10; i++)
        buf[i] = i * 2;

    int *p = malloc(sizeof(int));
    *p = buf[9] + 1;

    int total = 0;
    for (int i = 0; i < 10; i++)
        total += buf[i];

    free(p);
    return total;
}
```

There are two bugs here. Can you spot them? They're the kind that compilers won't warn about and that can easily slip through code review.

I asked Claude to "formally verify the code in demo.c using state of the art techniques". It recognized this as a verification task, activated the ESBMC skill, and ran the model checker with array bounds checking, overflow detection, memory leak analysis, and NULL pointer checks. Here's what it found.

### Bug 1: Array out-of-bounds write

ESBMC immediately finds that the first loop's condition `i <= 10` causes an off-by-one error. With an array of size 10, valid indices are 0-9, but the loop writes to `buf[10]`:

```
Violated property:
  file demo.c line 10 function main
  array bounds violated: array `buf' upper bound
  (signed long int)i < 10
```

This isn't a heuristic or a guess -- it's a formal proof that the property is violated, backed by a concrete counterexample trace showing exactly the state that triggers the bug.

### Bug 2: NULL pointer dereference

The model checker stops at the first violation, so after fixing the off-by-one, a second run catches the `malloc` without a NULL check:

```
State 23 file demo.c line 12 function main
  p = (signed int *)0

Violated property:
  file demo.c line 13 function main
  dereference failure: NULL pointer
```

ESBMC models `malloc` as potentially returning NULL (as the C standard permits), and proves that the dereference at line 13 is reachable in that case. Again, a concrete counterexample, not a warning.

## Why This Matters

Static analyzers flag potential issues. Bounded model checkers *prove* them. When ESBMC says "verification failed", it means there is a real, reachable execution path that triggers the bug, and it shows you exactly what that path is.

Having this integrated into Claude Code means you can ask it to verify your code as naturally as you'd ask it to write a test. The AI handles constructing the right ESBMC invocation and interpreting the counterexample traces, while the mathematical rigor comes from the model checker itself -- a nice separation of concerns.

## Formal Methods and the Age of Generated Code

I've been a fan of formal methods for a long time, but I'll be honest: I rarely used them in practice. The barrier was always friction. Setting up the tooling, learning the command-line options, figuring out the right unwind bounds, interpreting the output -- it was a lot of overhead for finding corner-case bugs that might not surface for months or years. The payoff was real but the upfront cost was hard to justify in day-to-day work.

I think that's about to change, and the reason is LLM-generated code. When an AI writes most of your code, you gain speed but you lose something: the deep familiarity with every line that comes from having typed it yourself. Subtle bugs -- off-by-one errors, missing NULL checks, integer overflows in edge cases -- are exactly the kind of thing that LLMs produce confidently and that humans skim past during review.

Formal verification is a natural counterpart to code generation. The LLM generates code fast; the model checker proves properties about it exhaustively. Together they give you something neither can offer alone: rapid development with mathematical guarantees that entire classes of bugs are absent. The LLM lowers the barrier to writing code, and the model checker lowers the barrier to trusting it.

This plugin is a small step in that direction -- making formal verification as easy as asking a question in your terminal. I hope it's the beginning of a much broader trend.

## Beyond the Basics

The demo above only scratches the surface. The plugin also supports:

- **Multi-language verification** -- C++, Python (with type annotations), Solidity smart contracts, and CUDA kernels.
- **Comprehensive audits** -- the `/audit` command runs six verification passes: a quick scan, memory safety, integer safety, concurrency checks, deep verification with higher unwind bounds, and a k-induction proof attempt.
- **Verification annotations** -- Claude knows ESBMC's intrinsics API and can add `__ESBMC_nondet_*()` for symbolic inputs, `__ESBMC_assume()` for preconditions, and `__ESBMC_assert()` for custom properties directly to your code.
- **Strategy selection** -- from incremental BMC for quick bug hunting to k-induction for unbounded proofs of correctness.

## Current Status

The plugin has landed upstream in the ESBMC repository ([commit 4b79ba4](https://github.com/esbmc/esbmc/commit/4b79ba4)). Give it a try if you have ESBMC installed -- I'd love to hear how it works for you.
