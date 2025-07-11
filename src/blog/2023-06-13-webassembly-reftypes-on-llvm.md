---
title: WebAssembly Reference Types in Clang/LLVM
description: Description of the implementation of WebAssembly Reference Types in Clang/LLVM
tags: ["webassembly", "llvm", "reference-types", "igalia"]
date: 2023-06-13
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

# WebAssembly Reference Types in LLVM

## Introduction

This post is an overview of the implementation of the [WebAssembly Reference Types proposal](https://github.com/WebAssembly/reference-types) in Clang/LLVM. It is a follow-up to two presentations:

* ["A walk on the weird side: Opaque WebAssembly values and LLVM"](https://www.youtube.com/watch?v=UxnUht3uWzc) (2021 LLVM Dev Mtg) by Andy Wingo, and
* ["Clang, Clang: Who's there? WebAssembly!"](https://www.youtube.com/watch?v=lwPg_Vjs7p4) (2022 LLVM Dev Mtg) by myself.

This is the culmination of a couple of years of work started by myself, Andy Wingo and Alex Bradbury at Igalia. It was sponsored in its entirety by Bloomberg.

The implementation followed a bottom up approach. We worked on the linker first, followed by the WebAssembly backend, MC layer and LLVM IR. Support for reference types has been available in LLVM IR for quite some time, but it was not exposed in Clang. Extending Clang to support values of reference type and tables was the last piece of the puzzle.

For context for the remainder of the post, I recommend watching the two presentations linked above. In summary, the work consisted of implementing support for the following reference types (read WebAssembly reference types unless stated, not C++ reference types) in LLVM:

* `externref`, which is a garbage collected reference type, and
* `funcref`, which is a non-nullable reference to a function.

In addition, we implemented support for WebAssembly tables, which are arrays of references. Since values of reference types cannot be stored to linear memory, tables are storage containers for these.

## Linker and MC Layer



## LLVM IR

## Clang

## Conclusions and Future

There was a lot of work done in the last few years to reach this point. Not just by Igalia but kind and patient reviewers and the WebAssembly Tools team at Google who offered a lot of advice on the matter. However, there is still work to be done to completely implement the WebAssembly Reference Types proposal. We don't support initialization of tables yet and the C++ language extension to deal with these types is not very developer friendly since it's based on builtins. A more ergonomic approach to solve table access, for example, would be to allow `table.get` and `table.set` to be deal as array access. For the moment the project is on hold, due to lack of funding. If you are interested in sponsoring this work, please get in touch with me.
