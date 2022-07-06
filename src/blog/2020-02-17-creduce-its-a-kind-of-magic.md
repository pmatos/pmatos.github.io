---
title: CReduce - it's a kind of magic!
description: During my tenure as a C compiler developer working on GCC and LLVM there was an indispensable tool when it came to fixing bugs and that was C-Reduce, or its precursor delta. Turns out this magic applies well to JavaScript, so lets take a quick glance at what it is and how to use it. 
tags: ["javascript", "creduce", "igalia"]
date: 2020-02-17
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

When I started compiler work [delta](http://delta.tigris.org/) was all the rage. It would turn a testcase with thousands of lines into a single small one with perhaps no more than 15 crashing your compiler in exactly the same way as the original testcase. I have used and abused this tool but it turns out it could be improved. John Regehr and his team did so with [C-Reduce](https://embed.cs.utah.edu/creduce/) (who by he way also developed [C-Smith](https://embed.cs.utah.edu/csmith/), but that's another store entirely).

C-Reduce takes things to another level squeezing that testcase ever farther until it's just a few bytes, and yet still crashing your compiler in the same interesting way it did before. In C and C++ this is a very important tool and its use is not [recommended](https://gcc.gnu.org/wiki/A_guide_to_testcase_reduction) often enough. It's very important and in languages like C and C++ because the preprocessor can a seemingly small example into a behemoth of a source file and therefore reducing the testcase appropriately is extremely important. The recommendation page for [reporting GCC bugs](https://gcc.gnu.org/bugs/) goes as far as saying:

> However, providing a minimal testcase increases the chances of
> getting your bug fixed. The only excuses to not send us the
> preprocessed sources are (i) if you've found a bug in the
> preprocessor, (ii) if you've reduced the testcase to a small file
> that doesn't include any other file or (iii) if the bug appears only
> when using precompiled headers. 

However, one advantage of `delta` was that it worked on any text file as opposed to C-Reduce that due its reduction strategy required the source to be C or C++. That is, until I was told I was wrong and that C-Reduce would be able to eat a large [Racket](https://racket-lang.org) and spit out a small one. This stayed in the back of my head until present day.

Currently I am working on JavaScriptCore, which turns out to have bugs of its own as well. Due to the way these JIT compilers are designed you can go through several compiler tiers, code generations, on stack
replacements and back until you find your bug. How great would it be if you could launch your compiler and the bug would reveal itself straightaway without having to wait for a breakpoint to be hit 60 times, step through 20 machine instructions and two OSR calls? 

Well, that's what C-Reduce is here for. I remembered being told it worked with Racket and if it works with Racket it must work with JavaScript.

I develop on a `x86_64` but my crash is on `MIPS32el` and I can reproduce it on `qemu-user` like this:

```shell
$ /home/pmatos/roots/br-root.jsc32-mips/host/bin/qemu-mipsel -L \
	/home/pmatos/roots/br-root.jsc32-mips/target ./WebKitBuild/Debug/bin/jsc \
	load-varargs-then-inlined-call-and-exit.js 
qemu: uncaught target signal 4 (Illegal instruction) - core dumped
```

The idea here is to reduce `load-varargs-then-inlined-call-and-exit.js` but keep the `Illegal instruction` error so I developed the simple reducing script:

```bash
#!/bin/bash
/home/pmatos/roots/br-root.jsc32-mips/host/bin/qemu-mipsel -L \
	/home/pmatos/roots/br-root.jsc32-mips/target /home/pmatos/dev/WebKit/WebKitBuild/Debug/bin/jsc \
	load-varargs-then-inlined-call-and-exit.js &> err.txt
grep -q 'Illegal instruction' err.txt
```

This simply redirects all output from `jsc` into a file and checks that the file still contains the error `Illegal instruction`. This file can be as complex as you want to constrain the error you wish to reproduce. For our present situation this is enough.

Then, call C-Reduce:

```shell
$ creduce --not-c --n 16 ./red.sh load-varargs-then-inlined-call-and-exit.js
===< 26334 >===
running 16 interestingness tests in parallel
===< pass_blank :: 0 >===
(0.6 %, 1046 bytes)
===< pass_lines :: 0 >===
(-0.3 %, 1055 bytes)
(1.2 %, 1039 bytes)
===< pass_lines :: 1 >===
(-1.9 %, 1072 bytes)
(17.6 %, 867 bytes)
(20.9 %, 832 bytes)
(26.5 %, 773 bytes)
(34.8 %, 686 bytes)
...
```

There are many arguments possible to creduce (which you can check with `creduce --help`. Here I used:

* `--not-c`: disable C/C++ specific passes, use for source languages that are, well, not C-like;
* `--n 16`: use 16 cores to do the reduction, the more the merrier. If you interestingness script takes a long time to run, grab yourself a coffee;
* `./red.sh`: path to the interestingness script (make sure it's executable);
* `load-varargs-then-inlined-call-and-exit.js`: testcase to reduce (this is going to be modified in-place);

After a while you'll be greeted with:

```shell
===================== done ====================

pass statistics:
  method pass_balanced :: curly2 worked 1 times and failed 18 times
  method pass_balanced :: curly-inside worked 1 times and failed 12 times
  method pass_clex :: rm-toks-11 worked 1 times and failed 105 times
  method pass_balanced :: parens-to-zero worked 1 times and failed 25 times
  method pass_blank :: 0 worked 1 times and failed 0 times
  method pass_clex :: rename-toks worked 2 times and failed 4 times
  method pass_lines :: 8 worked 2 times and failed 123 times
  method pass_lines :: 4 worked 2 times and failed 123 times
  method pass_lines :: 10 worked 2 times and failed 123 times
  method pass_lines :: 3 worked 2 times and failed 123 times
  method pass_indent :: regular worked 2 times and failed 0 times
  method pass_lines :: 6 worked 2 times and failed 123 times
  method pass_lines :: 2 worked 5 times and failed 134 times
  method pass_clex :: rm-tok-pattern-4 worked 5 times and failed 784 times
  method pass_lines :: 0 worked 5 times and failed 70 times
  method pass_balanced :: parens-inside worked 6 times and failed 7 times
  method pass_clex :: rm-toks-1 worked 7 times and failed 132 times
  method pass_lines :: 1 worked 7 times and failed 147 times
  method pass_clex :: rm-toks-2 worked 8 times and failed 116 times

          ******** /home/pmatos/dev/WebKit/load-varargs-then-inlined-call-and-exit.js ********

function b(a) {
  return { a: a + 1 }
}
function bar() { b.apply(this, array) }
function c() {
  bar()
  c()
}
array = [ 2147483647 ]
c()
```

Your test file now contains a much shorter testcase but will still crash your compiler in the same beautiful way.

```shell
$ /home/pmatos/roots/br-root.jsc32-mips/host/bin/qemu-mipsel -L /home/pmatos/roots/br-root.jsc32-mips/target ./WebKitBuild/Debug/bin/jsc load-varargs-then-inlined-call-and-exit.js 
qemu: uncaught target signal 4 (Illegal instruction) - core dumped
```

For comparison the original file had 41 lines and 1052 bytes and the reduced file has 9 lines and 137 bytes which is an 87% reduction in size. But the big improvement here is not that the file is just smaller but that the number of paths taken by `jsc` is much smaller taking me strange to the illegal instruction without JIT compiling functions I don't need or jumping through tiers I don't care.

Of course, this would work just as well in a non cross-platform environment. I just used `qemu-user` due to the nature of my bug. The important thing is to have a testcase, and a script to ensure that at each reduction step, you keep the interestingness of the testcase - in other words, a way to reproduce the failure.

Here are a few examples I can think of as a script for reduction:

* `jsc` crashes with a specific exit code so you create a script testing that specific exit code;
* `jsc` crashes with a specific output (above was `Illegal instruction`) but it could be anything else;
* `jsc` does not crash but generates some strange JIT code which you noticed by using `--dumpDisassembly=true`. Well, ensure in your interestingness script the exit code of `jsc` is 0, redirect the output to a file and parse for that specific JIT code block;

Most cases could probably be reduced (pun-intented) to the above three items. You reduce for a specific exit code, a specific error, or a specific block of text. Or a combination of these. 

In any case, if you implement your reducing script appropriately the result will be a testcase smaller than the original that passes your interestingness script - and C-Reduce will look like it is a kind of magic.
