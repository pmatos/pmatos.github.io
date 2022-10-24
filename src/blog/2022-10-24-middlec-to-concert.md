---
title: From Middle-C to Concert
description: How I went from starting to play piano from scratch to a public performance.
tags: ["music", "piano-playing"]
date: 2022-10-24
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

Last Saturday, on the 24th of September of 2022 I played piano publicly for the first time in a local concert organized for students of my piano teacher - [Takako Ono](http://www.takako-ono.com). My performance was far from perfect, but I am proud of it. This is a brief overview of my lessons and practice over the last 8 months.

Earlier this year, on January 18, I started playing the piano with a 30-minute lesson. What I mean by "started playing", is learning the location of the middle C on the piano. Or that when reading sheet music all of the following notes are the same - indeed, these are all middle C.

{% lyInsert "middlec.svg" %}
\version "2.22.2"

\header {
    tagline = ""
}

\score {
  \new PianoStaff \with {
    instrumentName = "Piano"
  } <<
  \new Staff = "right" \with {} {           \relative c' { c r c r c r c r c r \bar "|." } }
  \new Staff = "left" \with {} { \clef bass \relative c' { r c r c r c r c r c \bar "|." } } 
  >>
  \layout {}
}
{% endlyInsert %}

I knew what middle C was... I had been playing Ukulele for a while so I knew it was the note on the second string of the Ukulele, if it was tuned in standard tuning but was unaware of its relationship to the piano. 

I quickly learned to love the uniformity of the piano. If middle C is here, then the next note D is the white key next to it, and the E is the next one after. Also, there's only one place to play a given note.

I was beyond excited to be learning the piano. For a long time, I had been wanting to learn the piano, which I always saw as the king of all instruments. Taking the plunge and showing up to piano lessons was a dream come true. We started using the book [Alfred's Basic Adult Piano Course: Level 1](https://www.alfred.com/alfreds-basic-adult-piano-course-lesson-book-1/p/00-2236/) and over the months that followed we made steady progress on that. We would practice a couple of pieces one hand at a time during the lesson and I would perfect those at home to perform them in the following lesson. If all was ok, great - we moved ahead. If not, we would practice more together and I would perfect them again at home. We quickly got to June and my teacher asked me if I would like to play publicly in a student concert. I immediately said "Yes", which seemed to take her by surprise. Apparently, adult students and especially beginner students are not keen on joining concerts. At this point, we chose two pieces: Allegretto by Vanhal and Nächtliche Reise by Gurlitt. She played the pieces for me and I loved them so being able to play three months later seemed amazing. Of course, now I needed to be able to focus on them as they were slightly trickier than my weekly ones from Alfred's book. So for the following lessons, I focused on them and at home, I did the same. Every lesson was focused on perfecting some parts of each piece. And on Saturday it all came together.

My wife, both of my children, and my parents-in-law came to the concert and although I was anxious the whole day, I got slightly less anxious before. I didn't get nervous until pretty much it was my turn to play, but I didn't have a meltdown. That felt like it came later. The Vanhal piece was always the one I had the most trouble with and Gurlitt was the one that seemed easier. However, I played Vanhal first after the tradition of playing older pieces first. Vanhal was going very well and the first repetition was flawless. During the second repetition I thought that "it's just a matter of finishing the second repetition and then the easy piece is coming.". I deviated my look a bit from the keys as it occurred to me and as I looked into the keys, I forgot where in the scale I was and missed a beat. Damn! I continued as if nothing happened and I grew increasingly nervous wondering what else was going to happen. My brain went haywire as I started the easier piece and I missed a couple of beats. This was supposed to be the easy piece but I was murdering it. But like everything else, it came to an end. As I get up from the piano, everyone was clapping and afterward many people came to congratulate me but I was disappointed and couldn't shake the feeling I had screwed up.

My wife filmed it and I later watched, half covering my face in embarrassment, but noticed that actually, it sounded quite nice. And although, yes, there were a couple of lapses, unless you know the piece you wouldn't necessarily notice them.

I am just very excited I had the opportunity to join this concert and can't wait to do better, on harder pieces, next time.

When I decide to take on a new hobby, I want to give it all and be the best amateur I can be. I believe that you need a strategy instead of going at it Adhoc given you're doing it in your spare time and you have to fit things in with your family life.
So I will finish off with a few points and tips for absolute beginners from my journey that might be more interesting to read than the above memory dump. These are things that worked very well for me and that I would advise you to consider but they are in no way gospel or remotely generalizable. But if you see you're in a position to try them out, please do.

* Immerse yourself. If you are going to do a hobby make sure you stay up to date on developments and what's going on. Personally, I subscribed to Pianist, subscribed to [r/piano](https://www.reddit.com/r/piano) and [r/pianolearning](https://www.reddit.com/r/pianolearning), follow several pianists on Twitter like [@lang_lang](https://twitter.com/lang_lang), [@lars_vogt](https://twitter.com/lars_vogt), or [@daniil_trifonov](https://twitter.com/daniil_trifonov), and started listening to podcasts related to piano playing like the [Josh Wright Piano Podcast](https://open.spotify.com/show/72OQO63V0y3jZ0fh4tVlwj). In addition to that my knowledge and feeling for classical music were zero. Since then, I have been regularly putting on some classical music, looking at the scores (even if all pieces are impossible for me to play), and trying to appreciate how hard it must be to play them. I don't read a huge amount except on holidays when I tend to disconnect and read quite a bit. So these last Summer holidays saw me going through 3 books related to Piano playing that I recommend: [Play it Again: An Amateur Against the Impossible](https://www.goodreads.com/book/show/17332356-play-it-again) by Alan Rusbridger, [Journey of a Thousand Miles: My Story](https://www.goodreads.com/book/show/2727587-journey-of-a-thousand-miles) by Lang Lang and David Ritz, and [Piano Notes: The World of the Pianist](https://www.goodreads.com/book/show/589577.Piano_Notes) by Charles Rosen.

* Measure your progress. It's hard to know how much time you're actually putting in if you don't measure. You might guess but most likely you'll be wrong. I use a file where I write down all post-lesson notes about the lesson and track all my time in front of the piano at home using [Instrumentive](https://instrumentive.com/).

* Set a long-term goal to challenge yourself. Hard long-term goals are important in my opinion. They keep you focused with something to look forward to. If you were running, maybe a marathon could be a long-term goal. In piano, maybe playing a certain piece publicly (and this can mean to others or even just to your family who you invite for a concert). Some people recommend that you share that with others, or even post online for further motivation. I generally prefer to keep those (sometimes ridiculous goals) within a small circle of people. But I guess that's just a personal preference.

* Research the best. Within your chosen hobby there are always some who are at the top of it. Follow them on social media, read about them, and see how they practice, train, etc. How they got to where they are, etc. It's likely that as a hobbyist you might not be able to emulate everything they do or how they do it. However, I think that just knowing what's possible is incredibly motivating. At the moment, I always keep an eye on Lang Lang, Daniil Trifonov, and Josh Wright.

* Find support. Sometimes you have hobbies that are very social like playing football, poker, etc. Some other times it can be lonely like triathlon racing or piano playing. In any case, you should try to find some support... a little fan base. That can be your family or close circle of friends. Plan to play a piece for them, and ask them to criticize you. Keep playing, and improving. During the two weeks preceding my first public performance, I asked my wife and children to listen to me play every single evening before bedtime. They were and are my support, my fan base, and those who'll cheer for me even if I screw up. Find those people!

* Lastly: Prioritize, prioritize, prioritize! You'll need to prioritize a lot. If you need to take one or two hours of your day, you'll need to prioritize. Do I need to take that coffee break? Can I optimize my commute? Do I really need to watch that series on Netflix, etc? In the end, we all have 24 hours per day. What matters, is how we spend those 24 hours. There's no magic!

## Book references:

* Alfred's Basic Adult Piano Course : Level 1 (ISBN: 978-0739082416).
* Play it Again: An Amateur Against the Impossible (ISBN: 978-1250875402)
* Journey of a Thousand Miles: My Story by Lang Land and David Ritz (ISBN: 978-0385524575)
* Piano Notes: The World of the Pianist by Charles Rosen (ISBN: 978-0140298635)

## Music references:

* Allegretto by J. B. Vanhal
* Nächtliche Reise by C. Gurlitt

## Online Forums:

* [`r/piano`](https://www.reddit.com/r/piano), take a look especially at the [FAQ](https://www.reddit.com/r/piano/wiki/faq/)
* [`r/pianolearning`](https://www.reddit.com/r/pianolearning)

## Others:

* [Pianist Magazine](https://www.pianistmagazine.com/)
* [Josh Wright Piano Podcast](https://open.spotify.com/show/72OQO63V0y3jZ0fh4tVlwj)
* [Instrumentive Progress Tracking App](https://instrumentive.com/)