---
title: Life on GenAI in 2025 (part 1 - Intro and Education)
description: Usage of GenAI over the year 2025 - Education
tags: ["#genai #2025 #projects #claude #education"]
date: 2026-01-09
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

I was already following closely the developments in GenAI, but watching my kids navigate these tools pushed me to keep exploring the landscape and following the trends.
Late 2024 and early 2025, I progressively moved from ChatGPT to Anthropic's Claude and Google's Gemini. Claude stood out for its conversational depth and ability to maintain context, while Gemini made it easy to experiment with both simultaneously and was already included with my Google One Subscription.

Before I share specific use cases, though, it's important to talk about how I approach reliability when using these tools. LLMs are much better than they once were but still make mistakes. Different LLMs have different strengths and weaknesses—two models might perform equally well on certain benchmarks while struggling in completely different areas. For sensitive subjects like health or where I want to be more certain of something, I try to request science-backed responses that link to trusted websites and query multiple LLMs, so that I can compare the answers. Gemini itself will present its sources in an answer but you can also request a fact-check. When requested to do so Gemini will highlight the parts of the answer it's able to fact check, which is extremely useful.

Let me show you what I mean with a quick example—even for straightforward historical facts. So, was D. Afonso Henriques the first king of Portugal? Gemini 3 Pro seems to think it was.

![image](/img/2026/01/5beb0d68.png)

But you're not convinced... so now you can actually ask it to double-check the answer.

![image](/img/2026/01/badc1c74.png)

Within moments, you get the answer highlighted and the source for each stated fact.

![image](/img/2026/01/a4c066e3.png)

Clearly there's already a concern to try to establish the facts in answers given by Gemini 3 Pro and this will continue to improve so that hopefully answers will be grounded on facts that you can manually check if you want.

With these fact-checking tools in hand, I feel more confident using LLMs for learning new skills and helping my family. So with those caveats in mind, let me share how I've been using these tools, starting with education.

# Education

If I were studying full-time today, the experience would be dramatically more personal and exciting than when I was in school. Here are a few things that are possible now that simply weren't back in the day:

* Scan a few pages of your textbook, feed them to [NotebookLM](https://notebooklm.google.com), generate a quiz, a podcast, a video presentation or a slide deck.
* Ask Claude using the Learning style to explain a topic to you.
* Use Suno to generate a song with lyrics which include the verb you want to learn to conjugate in French.

The possibilities are pretty much endless depending on your learning preference. Kids these days will learn and want to use these technologies to get one step ahead. I have personally used these for my studies in Music Theory. Given that I am self-studying for the ABRSM exams, they have been extremely useful to help go through the curriculum without someone to ask.

Beyond my own learning, what really excites me about LLMs is their potential to democratize education—helping those without access to a tutor, or complementing traditional tutoring with material presented from different perspectives. 

Let me get specific about how I organize these conversations, because the structure makes a huge difference.

I use Claude Projects a lot as you'll see—these are workspaces where you can group related conversations and attach reference materials that persist across all chats. I tend to have projects to group a topic or set of chats. I have a project for "Piano Playing and Music Theory". There I group all my chats about:
- Goals - "are my goals for the next 6 months achievable given my progress in the last 6 months?"
- Doubts - "I really cannot understand compound time signatures. What's the point? How do I identify them?"
- Progress: "Given my current repertoire, what should I add next that takes me to the next level?" 

As project knowledge I add all my practice sessions, my repertoire and the knowledge I started with. This means that at any time I can prompt Claude and discuss my practice methodology, my pieces, and repertoire and I will know that Claude is answering me with the full picture rather than with partial context.

For example, when I asked about compound time signatures, Claude didn't just give me the textbook definition—it connected it to pieces I was already playing and explained how recognizing these patterns would help me with my current repertoire.

Another exciting avenue for education is creation of material for studying. A recent example is the upcoming Physics exam of my daughter. With a few photo snaps of her Physics book, my wife [queried Gemini for a learning plan](https://gemini.google.com/share/2e23260cb830). I then used this chat as a basis for Claude Code to create a [whole workbook](https://drive.google.com/file/d/1O8c8m3uOodzAFZDPMQ6fx1a0x7SEFIHP/view?usp=drive_link) with [solutions](https://drive.google.com/file/d/14Q8Pwv1sDvqu4aeuyIwLaDdfFT2QAft4/view?usp=drive_link) using Typst for my daughter.

But education is just one piece of the puzzle—I've found LLMs equally transformative for health and fitness goals, which I'll dive into next.