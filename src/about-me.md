---
title: About me
layout: page.njk
keyword: software engineer, compiler engineering, low-level systems, piano
tags: pages
permalink: "{{ title | slugify }}.html"
eleventyNavigation:
  key: "{{ title | slugify }}"
  title: About me
  order: 2
kicker: Particulars of the engraver
pageClass: is-about
eleventyComputed:
  particulars:
    - term: Name
      value: "{{ meta.authorName }}"
    - term: Based in
      value: "{{ meta.location }}, {{ meta.country }}"
    - term: Practice
      value: "Freelance software engineering"
    - term: Focus
      value: "Compiler engineering"
    - term: Piano
      value: "Since January 2022"
    - term: Elsewhere
      value: "[GitHub](https://github.com/{{ meta.githubUser }}), [LinkedIn](https://www.linkedin.com/in/{{ meta.linkedinkUser }}/)"
---

# About Me

I'm Paulo Matos, a freelance software engineer based in Nuremberg, Germany. I specialise in compiler engineering and low-level systems.

I enjoy work at the intersection of systems programming and performance optimisation, especially making software run where it wasn't originally designed to.

When I'm not writing code, you'll find me at the piano, out running, or in my sim-racing rig. I started learning piano in January 2022, knowing nothing beyond where middle C was, and gave my first public performance just eight months later. I'm a trained IRONMAN triathlete who completed several races between 2013 and 2019, though I stepped back from triathlon when COVID hit. These days I keep fit with running—most recently a half marathon in Mainz with my good friend Jesse Alama—and I'm still chasing faster lap times on the virtual track. I live with my partner and two children, and yes, I play more Fortnite than I probably should.

Feel free to reach out—I enjoy connecting with people working on interesting problems.