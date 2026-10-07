---
title: "Symphonika: building a software factory"
description: "From watching agents in Pewpew to giving them work: issue workflows, scheduled routines, and the decisions a software factory must leave to humans."
tags: ["agentic-coding", "tooling", "symphonika", "pewpew"]
date: 2026-10-07
image: /img/2026/10/symphonika-orchestrator.jpg
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
comments: false
---

![A software designer guides glowing musical pathways through a futuristic workshop where coding agents work at separate desks](/img/2026/10/symphonika-orchestrator.jpg)

Back in May, in [Pewpew: the terminals are down!](/blog/pewpew-the-terminals-are-down.html), I drew a spectrum of ways to work with coding agents. At one end you sit with a single agent in a terminal. In the middle, Pewpew gives you a canvas to see many sessions at once. Further along is orchestration, where you describe the work and something else starts the agents and follows it through. I said then that I had my own take on that last part, and promised a separate post.

This is that post. In it, I will introduce Symphonika, an orchestrator I built that picks up work from GitHub issues, runs coding agents in separate workspaces and follows each issue through a workflow defined by the repository. Then we will walk through what happens to one real ticket, look at the scheduled Routines that run without any ticket at all, and finish with where I still want to be in the loop. [Symphonika](https://github.com/pmatos/symphonika) is far from perfect, but it is a tool I use, and I am not presenting it as the final answer to how we will build software tomorrow. The interesting question, I think, is what happens when we stop organizing our day around sessions and start organizing it around work.

## From a canvas to a work queue

Pewpew is still open on my desktop. When I know a task will need hand-holding, or suspect that important decisions will come up while an agent is working, I want to see the session and step in, and the canvas is good at that. Symphonika therefore does not make the middle of the spectrum obsolete.

Most of my other work starts as tickets. I write some myself, and for larger ideas I ask an agent to turn an epic into smaller tickets using [`to-tickets` from Matt Pocock's skills](https://github.com/mattpocock/skills). Then I decide which of those tickets should go ahead, and I mark the suitable ones with a configurable pickup label, such as `ready-for-agent`. Symphonika takes them from there. In essence, the label means I think the ticket is specified well enough for an agent to try.

The inspiration was [OpenAI's Symphony](https://openai.com/index/open-source-codex-orchestration-symphony/), which began as a specification that invited people to build an orchestrator from it. I took that spec and built the version I could actually use. Symphony's early examples use Linear, but I built Symphonika around GitHub because that is where I track my work. The two parts that matter most to me are the state machines that live in each repository, for work that begins with an issue, and **Routines**, for work that begins with a clock.

## What happens to one ticket

Let's take [JSSE issue #858](https://github.com/pmatos/jsse/issues/858). In an async function, a resource declared with `await using` was being disposed of immediately when wrapped in a `with` block, instead of letting the function suspend. The public issue included a small reproduction and the expected ordering. Once it was picked up, the implementation ran through the JSSE workflow, and [PR #860](https://github.com/pmatos/jsse/pull/860) contains the resulting fix and its test evidence.

![The JSSE-only project view shows issue 858 succeeded and PR 860 merged; other public issues include blocked runs](/img/2026/10/symphonika-jsse-overview.png)

Let's look at the eleven-state workflow stored with that JSSE run. The paths through it are easier to read in a diagram than in the YAML that defines them.

![The eleven-state JSSE issue workflow: plan, implement, verify the PR exists, review, simplify, wait for checks, repair or resolve conflicts, merge, or stop blocked](/img/2026/10/symphonika-jsse-workflow.png)

[Open the workflow diagram at full size](/img/2026/10/symphonika-jsse-workflow.png).

It starts with a plan. Moving to implementation requires a `PLAN.md` and a new commit from that planning attempt, because an old plan left in the workspace is not enough. Implementation has its own commit gate. A separate wait-for-PR step then checks that the agent actually opened the pull request, since a committed branch alone does not prove that it did. After that, an agent reviews and fixes the PR, another pass simplifies it, and the workflow parks to watch the PR.

From that waiting point, passing checks and no unresolved review threads lead toward merge. Failed checks or review feedback send the work to autofix, and a merge conflict goes to resolve conflicts. Both return to the wait state, where the PR is observed again. There is also a blocked exit. The state machine makes no architectural judgments, it only makes the handoffs and gates explicit, including the conditions under which work should stop advancing. The [workflow file](https://github.com/pmatos/jsse/blob/main/symphonika/workflow.yml) lives in the repo with the code it governs.

Issue #858 is also a good reminder that a neat diagram only goes so far. The description of PR #860 records that its first plan missed part of the cause, so the implementation had to find and fix that too. The review and simplify passes found follow-up gaps and reported them rather than quietly growing the PR to absorb them. Another PR landed while this one was in progress, and the branch needed a conflict resolution. The workflow can route all of that and keep a record of what happened. However, whether newly discovered scope belongs in this change or deserves its own ticket is still a design decision, and one worth understanding.

## Work that does not start with a ticket

Issues are not the only source of work. A Routine is a scheduled prompt aimed at one or more chosen projects, and it fires on a clock instead of waiting for an issue. A `report` Routine can investigate and create an issue without making a commit, while a `git` Routine works on a branch and must commit its result. A new project does not silently inherit every Routine, so targets are always explicit.

One of mine runs against [music-timeline](https://github.com/pmatos/music-timeline), the public collection behind [Musiker](https://musiker.page). The relevant part of `new-composer` is short enough to show:

```text
Audit the codebase for the list of composers in the collection per instrument, then:
1. Search online for composers for the available instruments.
2. Identify his wikipedia page.
3. Create an issue in https://github.com/pmatos/music-timeline
   with the title: "New person: <NAME>"
```

This `report` Routine looks for missing people and creates issues for later work, and it never edits the collection directly.

Another Routine, `refactor-audit`, is a `git` Routine, and the same prompt can be scheduled against several explicitly selected repositories. Here is the generic part of its instructions:

```text
Run the pm-deepen skill against this repository to audit it for
refactoring opportunities and land the best one.

Do not re-prioritize its pick. Do not merge or approve the PR.
If the skill is unavailable, stop rather than improvising a replacement.
```

The Routine delegates the search and the implementation, but it fixes the selection rule and the stopping point. The full prompt also describes the repository's quality gate and resource limits, which I left out of this excerpt.

## Where I still want to be in the loop

On April 16, in [Code Is Free Now. What's Left Is Us.](/blog/code-is-free-now-whats-left-is-us.html), I argued that writing the code is ceasing to be the scarce part of software development. The scarce part is deciding what to build, what not to build, and how the system should fit together. Faster implementation therefore makes the decision not to build something more important, not less.

So, does a software factory mean I feed in an idea and accept whatever comes out? No! I choose the direction and the design constraints, the agents work out the implementation, and the workflow checks the things it knows how to check. Some clear, bounded changes can go through checks, review passes and merge without me watching a terminal. An underspecified feature, or a change likely to force a design choice halfway through, belongs where I can steer it more closely, either in Pewpew or in a conversation before I mark the ticket ready.

A green check also does not mean the agent made every right decision. The JSSE PR is a small example, because tests can show that a bug is fixed while the choice of what else the fix should cover still needs judgment. A state machine helps me say when work moves, pauses or returns for repair, but it cannot tell me which work is worth doing.

## What's next

Symphonika has moved the start of much of my work from "open a session" to "decide which ticket is ready", and Routines bring recurring searches and maintenance into the same rhythm. Pewpew remains my place for work that needs closer attention.

I am looking next at tooling for software design and decisions, namely recording why a choice was made and showing where an agent made an important one on its own. When implementation gets cheaper, I want a better account of those choices before I let more work run unattended.

## Thanks

Thanks to Matt Pocock for the skills I lean on to break epics into tickets, and to the OpenAI team behind Symphony for publishing the specification that started all of this.

## Corrections or Comments?

I am happy to receive corrections, and if Symphonika does something odd for you, [open an issue](https://github.com/pmatos/symphonika/issues/new) on the repository.
