---
title: "Introducing Musiker: An Interactive Timeline of Classical Music"
description: "Announcing musiker.page — an interactive visualization of classical music composers and players across centuries."
tags: ["music", "announcement", "rightkey"]
date: 2026-02-23
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

[Musiker](https://musiker.page) is an interactive timeline that maps the lifetimes and connections of classical music composers and players — from William Byrd in the 1540s to Lang Lang today.

![Piano timeline on musiker.page](/img/2026/02/musiker-piano-timeline.png)

## What You Can Explore

The site currently covers three instruments: **piano**, **violin**, and **trombone**. Each timeline lays out musicians as horizontal bars spanning their lifetimes, set against color-coded era backgrounds — Baroque, Classical, Romantic, Modern, and Contemporary.

Click on any person to open a detail panel with their portrait, biography, Wikipedia link, and a list of related people. Connection lines between musicians show teacher-student relationships (dashed blue) and family ties (solid red), making it easy to trace how musical traditions passed from one generation to the next.

You can zoom in with Ctrl+scroll to focus on a specific period, or scroll horizontally to explore the full span of centuries.

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 2rem 0;">
<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" src="https://www.youtube.com/embed/Nyh2OJA5UxY" title="Musiker promo video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

## Under the Hood

Musiker is a React + TypeScript application that renders everything as SVG — no charting libraries involved. The main challenge was fitting dozens of overlapping lifetimes into a readable layout. A greedy lane-packing algorithm assigns each person to the first available vertical lane where they don't overlap with anyone else, keeping the timeline compact without losing clarity.

The data is split into three concerns: a shared list of people with bios and metadata, a shared list of connections between them, and per-instrument configuration files that define which people appear and what eras to show. Adding a new instrument is just a matter of creating a new JSON file and listing the relevant people.

## Part of Rightkey

Musiker is built in collaboration with [Rightkey.app](https://rightkey.app), a music education platform. It's one piece of a broader effort to make classical music more accessible and easier to explore — whether you're a student, a teacher, or just curious about how Beethoven connects to Czerny connects to Liszt.

## Try It Out

Head over to [musiker.page](https://musiker.page) and explore. If you notice a missing composer, a wrong connection, or an instrument you'd like to see added, use the feedback links at the top of the page — suggestions and corrections are very welcome.
