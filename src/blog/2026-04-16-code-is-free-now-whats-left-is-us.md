---
title: "Code Is Free Now. What's Left Is Us."
description: "Reflections on 14 months of agentic coding and why the developer's job is becoming more human, not less."
tags: ["agentic-coding", "future", "llms", "software-engineering"]
date: 2026-04-16
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

![Humans in warm conversation while code dissolves into light around them](/img/2026/04/code-is-free-now.png)

In the first months of agentic coding, I grieved.

The joy of hunting a bug for weeks, the satisfaction of finally tracing it to a single misplaced condition, the meditative rhythm of writing code line by line. Gone. I had spent decades building a relationship with programming and suddenly the thing I loved doing was being done by something else. It felt like losing a craft I had spent my whole career perfecting.

I wasn't alone. Nolan Lawson captured this feeling perfectly in [We Mourn Our Craft](https://nolanlawson.com/2026/02/07/we-mourn-our-craft/). He gave words to what many of us felt but struggled to articulate. The mourning is real, and it's understandable.

But that's not where the story ends.

## Then: July 2025

In July 2025, a few months into using Claude Code daily, I recorded some voice notes trying to make sense of what was happening. The tools were already good but rough around the edges. Orchestrating multiple agents across worktrees was manual and painful. Getting notified when an agent finished a task meant checking your terminal every few minutes. Choosing the right model for the right job (planning vs. implementation vs. review) was guesswork.

I knew things would improve. What I didn't know was how fast.

At the time I was wrestling with basic questions: Can I trust an agent to implement a feature unsupervised? How do I review code I didn't write? What does my job even look like if the machine writes the code? I had more questions than answers, and the tooling wasn't helping me find them faster.

## Now: April 2026

Fourteen months in, the landscape looks different.

Last week I returned from AI Engineer and the shift was palpable. What was once a niche topic on a side track is now the default assumption. Every company represented there was using agents, developing agents, or deploying agents. The conversations didn't start with "are you using AI for coding?" but with "how are you orchestrating your agents?" The question is no longer whether. It's how.

The tooling caught up too. We have Claude Code with Opus 4.6, skills, hooks, MCPs, and multi-agent orchestration. We have OpenClaw. We have GPT 5.4 and the lightning-fast 5.3-codex-spark. The harnesses are better, the workflows are more mature, and the rough edges I struggled with in July 2025 have been sanded down significantly.

In January, I [built a JavaScript engine in Rust](/blog/jsse-a-javascript-engine-built-by-an-agent.html) entirely through agentic coding. 170,000 lines of Rust. 100% of test262 non-staging tests passing. Zero lines written by me. My total hands-on-keyboard time was about four hours spread across six weeks. When I tell people this, they focus on the "zero lines" part. But the interesting part is what I was actually doing with my time: planning, reviewing architectural decisions, choosing what to work on next, and occasionally telling the agent to stop avoiding the hard problems. The work was strategic, not mechanical.

That project changed how I think about my role.

## The Role Shift

Here is what I've come to believe after 14 months of practice: the developer's job is no longer to write code. It's to specify intent, verify behavior, and architect systems.

This isn't a prediction about the future. It's a description of my present. I spend my days thinking about what should be built, how the pieces fit together, and whether the output meets the requirements. The act of translating intent into syntax, the thing we used to call "programming," is increasingly handled by the machine.

What remains is the hard part. The part that was always the hard part, honestly, but that we used to spend less time on because we were so busy typing.

## More Human, Not Less

Here's the thing nobody seems to be saying: agentic coding makes software engineering more human, not less.

Think about it. Machines can code. They're getting better at it every month. But it's the human who needs to tell the machine what to code, and in many instances, how to code it. Humans will do what humans do best: meet, discuss, and reach a consensus on what's needed.

In a world where code is developed at near-zero cost and near-instant speed, what's left is the human side of software engineering. The discussion of what should be built. The negotiation of trade-offs. The alignment of a team around a shared vision. Our jobs will be more human.

There's a paradox here too. Before, we didn't implement all the features because there was no time. Now there's time. So the difficult part shifts. It's no longer "can we build this?" but "should we build this?" Just because you can, it doesn't mean you should. The constraint is no longer engineering capacity. It's human judgment.

## What Happens to Code Review?

Code review is one of the clearest examples of how practices are evolving in real time.

When an agent generates thousands of lines in a single session, the traditional model of reading every diff line by line breaks down. It's not possible to do code review in the same way. If you're working alone, you can push code without a thorough review and fix things later. But when you're collaborating with others, review matters because human time is on the line, and human time is the scarce resource now.

The strategy I've found most effective: small, focused changes. Many of them, if needed. But each one small enough to review meaningfully, and small enough to revert cleanly without the rest of the system falling apart. This isn't new advice, but it takes on new urgency when an agent can generate a 2,000-line PR in twenty minutes if you let it.

In the future, better models and better harnesses will integrate more tightly with verification and testing tools, which may make traditional review less essential. I'll have more to say about this in a future post on integrating formal verification into the agentic coding feedback loop. But for now, the practical answer is: keep changes small, keep them focused, and accept that the review process is evolving.

## What Should You Study?

If you're at university studying software engineering right now, prepare yourself for agentic coding. The curriculum you're following was designed for a world where humans write all the code. That world is ending. The fundamentals still matter (architecture, systems thinking, design, verification) but the emphasis on syntax mastery and manual implementation will age poorly.

If you're a teenager wondering whether software engineering is the right path: it's hard to know exactly what will be here in 10 years. The field is going to look radically different. What I'd suggest instead is to be a generalist. Have a wide reach. Build connections across different areas. Be interested in many things. Extremely specific knowledge won't stay relevant when the tools are changing this fast.

What will be essential: hard-working, smart people with great relationships and the ability to bridge between different areas when needed. People who can communicate, who can see the big picture, who can bring others along. And above all, people who are good human beings. The more our tools handle the mechanical work, the more the human qualities matter.

## Where the Trend Points

Someone once said: predictions are hard, especially about the future. I won't try to pin dates on what's coming. But trends are easier to read than futures.

The trend is clear: stronger models, better harnesses, smarter workflows, more targeted tools for agentic coding. If you follow that trend line, it's easy to see a world where everyone is doing agentic coding and humans are directing rather than implementing. We'll see more software, not less. Hyper-personalized software, because people can. It's possible we'll then see consolidation as a few solutions emerge as more successful than others. But right now we're in the experimentation phase, and it's exciting to see all sorts of ideas being tested.

A few directions I'm particularly interested in, and will write about separately:

The first is integrating verification into the agentic coding feedback loop. If agents write the code, we need automated ways to ensure correctness that go beyond testing. I've been working on the [integration of ESBMC and Claude Code](/blog/formal-verification-in-your-terminal-esbmc-meets-claude-code.html) and there's a much larger story to tell there.

The second is the emergence of programming languages designed for agents. Languages that are easier for machines to generate and that can produce proof certificates for humans to verify correctness. I'm developing one such language (more on that in a later post), and projects like [MoonBit](https://moonbitlang.com) are already exploring this space.

## After the Mourning

I won't pretend the transition was smooth. For months the work felt like it had boiled down to reviewing broken agent output and fixing things the model got wrong. It was frustrating. It felt like the joy had been extracted from the work and replaced with a tedious supervisory role.

But things improved. I understood the flow, the tools, the rhythm of working with agents. And something unexpected happened: I found a different passion. Not the old satisfaction of crafting code by hand, but a new kind of thrill. The thrill of seeing an idea materialize in hours instead of months. Of building things I never could have built alone. Of spending my time on the interesting problems, the design, the architecture, the "what should we build?" rather than the "how do I implement this loop?"

If you identify yourself as someone who can only code and that's it, then this is going to be a painful ride. But if you can let go and look at what's on the other side, there's a world that is more exciting than the one we had before. A world where the work is more creative, more collaborative, and more fundamentally human.

The code is free now. What's left is us.

That's not a loss. That's a beginning.
