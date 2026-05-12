---
title: "Pewpew: the terminals are down!"
description: "Fifteen Ghostty terminals, one canvas, and the suspicion that the IDE is the wrong shape for the agentic era."
tags: ["agentic-coding", "claude", "codex", "tooling", "pewpew"]
date: 2026-05-12
image: /img/2026/05/pewpew-watchtower.jpg
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
comments: true
---

![A watchtower over a workshop floor where many agents are at work](/img/2026/05/pewpew-watchtower.jpg)

By mid-March I had fifteen [Ghostty](https://ghostty.org) terminals open. Each one running Claude Code, each one tied to a different project, each one shouting silently for attention from behind the next tab. I had stopped knowing which session was on which branch. I had stopped knowing how many PRs I had open. A scroll through `~/dev` told me there were nine repos with uncommitted work and I could not have told you what the work was.

Then something I read on X tipped me over, and that evening I started a new repo called [pewpew](https://github.com/pmatos/pewpew). I thought I was building a tool. Two months later I suspect I was building something else.

## The spectrum

There is a spectrum that nobody talks about explicitly, even though everyone doing agentic coding at scale is somewhere on it.

![The spectrum of agentic-coding interfaces, left to right: one terminal, chaos of many, canvas surveillance, full orchestration](/img/2026/05/pewpew-spectrum.jpg)

At the left end is the way most people start: one Claude Code in one terminal, you drive, you see. It scales as far as your attention does, which is to one agent.

A step right and you are running several agents in several terminals. You are still driving but you have lost visibility. Sessions blur into each other. You forget what is queued where. This is the position I lived in for the months before pewpew.

Further right is full orchestration: a system that fans work out to many agents, manages their lifecycles, and reports back. [OpenAI's Symphony](https://openai.com/index/open-source-codex-orchestration-symphony/) sketches this end of the spectrum. I have my own take on it, but that is a different post.

pewpew sits in the middle. You are still the one steering. But you can see everything at once. The bet is that the middle of the spectrum is its own destination, not a way station to full orchestration.

## I lost the map

The honest version of what broke me was not that I lost a particular agent. It was that I lost the map of my own work.

How many projects am I active in this week? How many issues am I working on? Are there PRs open for that issue? Did the verifier agent on `vow` finish, or did it stall? Is that worktree clean? Did I push the branch?

I have never been good at multitasking. Agentic coding handed me parallelism my brain was not built for, and for a while I tried to compensate by holding more state in my head. That works until it doesn't, and then it stops working all at once. The day I started pewpew, it had stopped working for a while.

## What I built

pewpew is a desktop app that scans whichever directories you point it at (set via `scanDirs` in `~/.config/pewpew/config.json`) for git repos, sets up [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [Codex](https://github.com/openai/codex) hooks on the projects you opt in, and lets you launch sessions inside per-session git worktrees and tmux sessions. Each session shows up as a card on a zoomable canvas, with a live terminal thumbnail and a state badge.

The cards group by project into **clusters**: dashed-border boxes that hold all the sessions for a given repo. When I open several sessions at once on the same project, I can fan them out into **swimming lanes**: vertically aligned strips that let me drop into each session in turn, including a per-lane review mode for reading the agent's output or PR feedback before deciding what to do.

![Pewpew main canvas with fourteen sessions across nine projects, clustered by repo](/img/2026/05/pewpew-canvas.png)

This is the canvas as I write this. Fourteen sessions across nine projects. Ten of them running. I can tell at a glance that `vow` has four active sessions, two on PRs and two on issues. `s11` has two arch-specific worktrees side by side. `pewpew` itself has two sessions on different issues — I dogfood it, of course. The sidebar shows every project with active work and a green dot when something is live inside it.

Two things to notice. First, every card carries the branch and the GitHub issue or PR number it is tied to. That single piece of metadata recovered most of what I had lost: I no longer need to remember which terminal was working on which issue, because the card tells me. Second, each card has a one-letter agent badge. **C** for Claude Code. **X** for Codex. Today there are ten C's and four X's on the canvas. OpenCode is the obvious next addition; it integrates via plugins rather than hooks, which is the work that has kept it off the canvas so far.

A pulsing card means an agent needs me. The whole point of the canvas is that I don't have to go looking — the pulse finds me.

## Daily life

The day shape is this. I open pewpew in the morning. I scan the canvas. I see what is running, what is waiting, what is finished. Sessions survive the laptop sleeping and the app closing because tmux keeps them alive underneath; I treat them like running services rather than ephemeral terminal tabs.

When a card pulses, I zoom in. If it is a fast question — pick a branch name, confirm a destructive operation, choose between two designs — I answer it inside the card without context-switching the whole UI. If it is a review moment — the agent has opened a PR, CI has come back, a peer review has landed — I expand the cluster into swimming lanes and use the per-lane review mode to read what happened.

<img src="/img/2026/05/pewpew-lane-review.png" alt="A pewpew session card for vow/pr-344 showing branch name, PR badge, status, and the agent's recent review reply" style="max-width: 50%; display: block; margin: 0 auto;">

The card above is one from earlier this morning. Branch, PR number, status, time since last activity, and the tail of what the agent had just written all on a single card. In this case the agent had handled a Codex code review on PR #344 of [vow](https://github.com/pmatos/vow), the verifier I am building, posted an acknowledgment, run CI, and parked itself in `Running C` until I told it what to do next. The whole exchange lived inside one card. I never opened a browser. I never `cd`'d into the worktree.

![Pewpew demo: canvas to swimming lanes to per-lane review](/img/2026/05/pewpew-demo.gif)

That is the loop. Canvas to cluster to lane to review to answer to canvas. It is not flashy. That is the point.

## I am not alone

I want to be clear that pewpew is not a unique idea. It is a parallel discovery.

Anyone running agents at scale right now is feeling the same problem and reaching for the same shape of answer. The Claude Code status line gained PR-number and branch fields a couple of releases back. [Claude Agent View](https://x.com/claudeai/status/2053940934736228454) shipped in version 2.1.139 — a built-in viewer inside the CLI. Two days ago [Dedene posted](https://x.com/dedene/status/2053575496718512507) a thing with the same shape of UI from a different angle. There are probably four others I have not seen.

This is what I meant in [Code is free now, what's left is us](/blog/code-is-free-now-whats-left-is-us.html). When the cost of writing the tool you need drops to an afternoon, parallel discovery becomes the default. The convergence is not a coincidence — it is evidence that the spectrum has a real middle, and that the missing surface for that middle is what everyone is independently inventing.

Pewpew's particular take is that the surface is **project-centric** and **agent-agnostic**. Project-centric because my mental model is `vow, jsse, pewpew, …`, not `session-3a91, session-3a92, …`. An in-CLI viewer thinks in sessions because that is what the CLI knows about. Pewpew thinks in projects because that is what *I* know about. Agent-agnostic because I run both Claude Code and Codex on the same canvas today, and the next surface — whatever wins — cannot belong to one vendor.

## After the IDE

Here is the bigger claim I have been circling, the one I do not think pewpew is large enough to prove on its own but which I now suspect is true.

The IDE was designed for one human writing one file at a time. It is a beautiful answer to that problem, refined over thirty years. But the problem has changed. When agents write the code, the center of gravity moves off the editor and onto the supervision surface. The next IDE — if we still call it that — has to answer four questions the current one cannot:

**What are they doing?** Not "what is in this buffer," but what each of N agents, across N projects, in N branches, is busy with right now. Modern IDEs answer "what is in this buffer" with breathtaking fidelity. They answer "what are all your agents up to" with nothing.

**Where are they doing it?** Which project, which worktree, which branch, which issue, which PR. A view that snaps the answer to the unit my brain holds work in, which is the project, not the file.

**Do they need me?** Out of N agents, which one is paused on a question only I can answer? The IDE has notifications for compile errors and test failures inside *this* buffer. The next surface needs notifications that route my attention across all of them.

**What did they finish?** When an agent opens a PR or a reviewer leaves feedback, where do I read it and decide? Today this is split across GitHub, the terminal, the IDE, Slack, and a thousand tabs. The next surface pulls it into one place.

The IDE answers one question — *what's in the file in front of you?* The next surface needs to answer four. That is the shape of the work.

I do not think pewpew is that next surface. It is too rough, it is mine, it is shaped by the way I happen to think. But I do think it is one of many small experiments pointing in the same direction. Claude Agent View is another. The Codex orchestration UI sketches are another. Somewhere in the next eighteen months these will collide and consolidate, and the winner will not look like VS Code.

VS Code is not going away. But it cannot stay what it is. Either it evolves to answer those four questions, or other tools that already do will pull the center of your day toward them. Both paths are fine. Either way, the center is moving.

## Step in the right direction

I am suspicious of any claim, including this one, that the thing the author happens to use is also the thing everyone will use in five years. Pewpew is what I have today. It is good enough that I have not gone back to fifteen Ghostty terminals, and bad enough that I keep finding things to fix on it daily. It is a step. Not the destination.

Two months of daily use have not turned me into someone who is good at multitasking. They have turned me into someone with a canvas. The canvas does what I used to fail at, which is keeping the map of the work in front of me. The agents do what I used to do, which is type. And in between, what is left is the part I always wanted to be doing — deciding what should be built, and reading what was built, and saying yes or no.

The terminals are down. I do not miss them.
