---
title: Announcing Racket Bitvectors (`bv`)
description: Announcing a new racket package `bv` for manipulating bitvectors with a `rosette`-style API.
tags: ["announcement", "racket", "package", "bitvector", "bv", "rosette"]
date: 2020-05-31
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

Announcing a new racket package [`bv`](https://pkgs.racket-lang.org/package/bv) for manipulating bitvectors with a `rosette`-style API.

```shell
$ raco pkg install bv
```

Racket [`bv`](https://pkgs.racket-lang.org/package/bv) ([source](https://github.com/pmatos/racket-bv) and [documentation](https://docs.racket-lang.org/bv/index.html)) is a package for bitvector manipulation. The interface follows the names and conventions defined by [`rosette`](https://pkgs.racket-lang.org/package/rosette) and its long-term goal is to be a high-performance bitvector library.

I am happy to receive any bug reports and feature requests you might have in the [project's GitHub page](https://github.com/pmatos/racket-bv/issues/new).

# Why?

This package release has been extremely overdue. It was first developed in 2017 and much improved through 2018 as part of [s10](https://linki.tools/s10.html), it hasn't seen the light of open source until now. Partially because it was intertwined with a lot of other code and partially because I never bothered to sit down and write some documentation.

I am slowly untangling [s10](https://p.ocmatos.com/s10.html) into libraries and documenting them and hope to release them as open source sooner or later. The reason the library has a `rosette` API because I needed a fast bitvector library with the same API rosette uses due to constraints on how I engineered the equivalence solvers and search techniques within [s10](https://p.ocmatos.com/s10.html) however, I think it turned out to be a good decision in any case because the API is intuitive and it has great naming for functions operating on bitvectors.