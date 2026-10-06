---
title: "Symphonika: building a software factory"
description: "From watching agents in Pewpew to giving them work: issue workflows, scheduled routines, and the decisions a software factory must leave to humans."
tags: ["agentic-coding", "tooling", "symphonika", "pewpew"]
date: 2026-10-06
image: /img/2026/10/symphonika-conductor.png
layout: article.njk
permalink: /blog/2026-10-06-symphonika-building-a-software-factory.html
eleventyExcludeFromCollections: true
robots: noindex, follow
draft: true
comments: false
---

![A conductor at a score desk directs a workshop of coding agents, with a second desk close enough for hands-on work](/img/2026/10/symphonika-conductor.png)

In [Pewpew: the terminals are down!](/blog/pewpew-the-terminals-are-down.html), I drew a spectrum of ways to work with coding agents. At one end, you sit with one agent in a terminal. In the middle, Pewpew gives you a canvas for seeing many sessions at once. Further along is orchestration: you describe the work, and something else starts the agents and follows it through. I said I had my own take on that last part, and promised a different post.

This is that post. I built [Symphonika](https://github.com/pmatos/symphonika), an orchestrator that picks up work from GitHub issues, runs coding agents in separate workspaces, and follows each issue through a workflow that the repository defines. It also runs scheduled **Routines** that do not need an issue to start. It is a tool I use now, not a finished answer to how we will build software tomorrow. The interesting question is what happens when we stop organizing our day around *sessions* and start organizing it around *work*.

## From a canvas to a work queue

Pewpew is still open on my desktop. When I know a task will need hand-holding, or suspect that important decisions will emerge while an agent is working, I want to see the session and step in. The canvas is good at that. Symphonika does not make that middle of the spectrum obsolete.

Most of my other work starts as tickets. I write some myself; for larger ideas I ask an agent to turn an epic into smaller tickets using [`to-tickets` from Matt Pocock's skills](https://github.com/mattpocock/skills). Then I decide which of those tickets should go ahead. I mark suitable ones with the project's pickup label, and Symphonika takes them from there. On JSSE that label is `agent-ready`; another project uses `ready-for-agent`. The label is not a declaration that the design no longer matters. It is my decision that this piece of work is specified well enough to let an agent try.

The inspiration was [OpenAI's Symphony](https://github.com/openai/symphony). It began as a specification that invited people to build an orchestrator from it. I took that spec and built the version I could actually use. Symphony's early examples use Linear; my work already lives on GitHub. That is a circumstance, not the thesis. The choices I keep coming back to in Symphonika are **repository-owned state machines** for work that begins with an issue, and **Routines** for work that begins with a clock.

## What happens to one ticket

Take [JSSE issue #858](https://github.com/pmatos/jsse/issues/858). In an async function, a resource declared with `await using` was being disposed of immediately when wrapped in a `with` block, rather than allowing the function to suspend. The public issue included a small reproduction and the expected ordering. Once picked up, its implementation ran through the JSSE workflow; [PR #860](https://github.com/pmatos/jsse/pull/860) contains the resulting fix and its test evidence.

![The JSSE-only project view shows issue 858 succeeded and PR 860 merged; other public issues include blocked runs](/img/2026/10/symphonika-jsse-overview.png)

The diagram below redraws the **actual eleven-state workflow** stored with that JSSE run; it is not a generic flowchart drawn to sell the idea. The paths through it are easier to read than the YAML that defines them.

![The eleven-state JSSE issue workflow: plan, implement, verify the PR exists, review, simplify, wait for checks, repair or resolve conflicts, merge, or stop blocked](/img/2026/10/symphonika-jsse-workflow.png)

[Open the workflow diagram at full size](/img/2026/10/symphonika-jsse-workflow.png).

It starts with a **plan**. Moving to implementation requires a `PLAN.md` and a new commit from that planning attempt; an old plan left in the workspace is not enough. **Implement** has its own commit gate. A separate **wait for PR** step checks that the agent actually opened the pull request: a committed branch alone does not prove that it did. Then an agent reviews and fixes the PR, another pass simplifies it, and the workflow parks to watch the PR.

From that waiting point, passing checks and no unresolved review threads lead toward merge. Failed checks or review feedback send the work to **autofix**; a merge conflict goes to **resolve conflicts**. Both return to the wait state, where the PR is observed again. There is also a blocked exit. The state machine is not making architectural judgments: it is making the handoffs and gates explicit, including the conditions under which work should *not* advance. The [workflow file](https://github.com/pmatos/jsse/blob/main/symphonika/workflow.yml) is in the repo with the code it governs.

Issue #858 is also a useful reminder of the limits of a neat diagram. PR #860's description records that its first plan missed part of the cause; the implementation had to find and fix that too. Its review and simplify passes identified follow-up gaps rather than silently expanding the PR to absorb them. Another PR landed while this one was in progress, and the branch needed a conflict resolution. The workflow can route that work and retain evidence of what happened. Whether the newly discovered scope belongs in *this* change, or deserves its own ticket, is still a design decision worth understanding.

## Work that does not start with a ticket

Issues are not the only source of work. A **Routine** is a scheduled prompt aimed at one or more chosen projects. Unlike the issue workflow, it fires on a clock; a `report` Routine can investigate or create an issue without making a commit, while a `git` Routine works on a branch and must commit its result. A new project does not silently inherit every Routine: targets are explicit.

One of mine runs against [music-timeline](https://github.com/pmatos/music-timeline), the public collection behind [Musiker](https://musiker.page). The relevant part of `new-composer` is short enough to show:

```text
Audit the codebase for the list of composers in the collection per instrument, then:
1. Search online for composers for the available instruments.
2. Identify his wikipedia page.
3. Create an issue in https://github.com/pmatos/music-timeline
   with the title: "New person: <NAME>"
```

This is a `report` Routine. Its job is to look for missing people and create candidates for later work, not to edit the collection directly. It demonstrates a different direction of travel: an agent can *propose* work, while the decision to take it on remains separate.

Another Routine, `refactor-audit`, is a `git` Routine. The same prompt can be scheduled against several explicitly selected repositories. Here is the public-project-independent part of its instructions:

```text
Run the pm-deepen skill against this repository to audit it for
refactoring opportunities and land the best one.

Do not re-prioritize its pick. Do not merge or approve the PR.
If the skill is unavailable, stop rather than improvising a replacement.
```

That is more than “ask an agent to refactor something.” The Routine delegates the search and the implementation, but specifies the selection rule and a stopping point. The full prompt also describes the repository's quality gate and resource limits; I have kept this excerpt free of project-specific details. A recurring task can have a contract without becoming a blank cheque.

## Where I still want to be in the loop

In [Code Is Free Now. What's Left Is Us.](/blog/code-is-free-now-whats-left-is-us.html), I argued that writing the code is ceasing to be the scarce part of software development. The scarce part is deciding **what to build, what not to build, and how the system should fit together**. Faster implementation makes the decision *not* to build something more important, not less.

“Software factory” can sound as though you feed in an idea and accept whatever comes out. That is not how I use these tools. I choose the direction and design constraints; agents figure out the implementation, and the workflow checks the evidence it knows how to check. Some clear, bounded changes can go through checks, review passes and merge without me watching a terminal. An underspecified feature, or a change likely to force a design choice mid-flight, belongs where I can steer it more closely—in Pewpew, or in a conversation before I mark a ticket ready.

Nor does a green check mean the agent made every right decision. The JSSE PR is a small example: tests can demonstrate that a bug is fixed, while the choice of what *else* the fix should encompass still needs judgment. A state machine helps me say when work moves, pauses, or returns for repair. It does not settle which work is worth doing.

## The next instrument

Symphonika has moved the start of much of my work from “open a session” to “decide which ticket is ready.” Routines move recurring searches and maintenance into the same rhythm. Pewpew remains my place for work that needs closer attention. Both are experiments, and neither is the end of this story.

The gap I am looking at next is not simply how to launch more agents. It is tooling for **software design and decisions**: making a choice, recording why it was made, and seeing where an agent made a consequential choice on its own. If implementation keeps getting cheaper, understanding those choices will matter more than counting how many agents ran overnight. The factory can build; we still need to know what it was asked to build, what it decided along the way, and whether we wanted that at all.
