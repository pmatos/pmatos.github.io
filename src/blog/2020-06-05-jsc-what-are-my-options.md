---
title: JSC - what are my options?
description: Compilers tend to be large pieces of software that provide an enormous amount of options. We take a quick look at how to find what JavaScriptCore (JSC) provides.
tags: ["webkit", "igalia"]
date: 2020-06-05
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

Compilers tend to be large pieces of software that provide an enormous amount of options. We take a quick look at how to find what JavaScriptCore (JSC) provides.

If you grab a copy of the WebKit source, you can easily build `jsc` with `Tools/Scripts/build-jsc --release --jsc-only` (from the WebKit root directory). As usual, running the resulting binary will get you into a JavaScript REPL. For example (`$` indicates the shell prompt):

```shell
$ WebKitBuild/Release/bin/jsc
>>> 2+2
4
>>> 
```

That was simple enough, but which options does JSC accept? Using `--help` will give you some information but if you're debuggin JSC, you might be interested in `--options`.

```shell
$ WebKitBuild/Release/bin/jsc --options
All JSC runtime options:
   useKernTCSM=true   ... Note: this needs to go before other options since they depend on this value.
   validateOptions=false   ... crashes if mis-typed JSC options were passed to the VM
   dumpOptions=0   ... dumps JSC options (0 = None, 1 = Overridden only, 2 = All, 3 = Verbose)

...
```

There is a huge amount of options and parameters to tune the execution of JSC, so here are some filtering hints.

For verbosity related options:

```shell
$ WebKitBuild/Release/bin/jsc --options 2>&1 | grep verbose
   verboseDFGBytecodeParsing=false
   verboseCompilation=false
   verboseFTLCompilation=false
   verboseValidationFailure=false
   verboseOSR=false
   verboseDFGOSRExit=false
   verboseFTLOSRExit=false
   verboseCallLink=false
   verboseCompilationQueue=false
   verboseExitProfile=false
   verboseCFA=false
   verboseDFGFailure=false
   verboseFTLToJSThunk=false
   verboseFTLFailure=false
   verboseSanitizeStack=false
   verboseVisitRace=false
   verboseExecutableAllocationFuzz=false
```

For JIT related options:

```shell
$ ~/dev/WebKit/WebKitBuild/Debug/bin/jsc --options 2>&1 | grep JIT    
   useJIT=true   ... allows the executable pages to be allocated for JIT and thunks if true
   useBaselineJIT=true   ... allows the baseline JIT to be used if true
   useDFGJIT=true   ... allows the DFG JIT to be used if true
   useRegExpJIT=true   ... allows the RegExp JIT to be used if true
   useDOMJIT=true   ... allows the DOMJIT to be used if true
   crashIfCantAllocateJITMemory=false
   dumpDisassembly=false   ... dumps disassembly of all JIT compiled code upon compilation
   logJITCodeForPerf=false
   bytecodeRangeToJITCompile=<null>   ... bytecode size range to allow compilation on, e.g. 1:100
   reportBaselineCompileTimes=false   ... dumps JS function signature and the time it took to BaselineJIT compile
   useFTLJIT=true   ... allows the FTL JIT to be used if true
   enableJITDebugAssertions=true
   useConcurrentJIT=true   ... allows the DFG / FTL compilation in threads other than the executing JS thread
   jitPolicyScale=1   ... scale JIT thresholds to this specified ratio between 0.0 (compile ASAP) and 1.0 (compile like normal).
   thresholdForJITAfterWarmUp=500
   thresholdForJITSoon=100
   forceGCSlowPaths=false   ... If true, we will force all JIT fast allocations down their slow paths.
   alwaysGeneratePCToCodeOriginMap=false   ... This will make sure we always generate a PCToCodeOriginMap for JITed code.
   useBBQJIT=true   ... allows the BBQ JIT to be used if true
   useOMGJIT=true   ... allows the OMG JIT to be used if true
   traceBaselineJITExecution=false
   dumpJITMemoryPath=""
   dumpJITMemoryFlushInterval=10   ... Maximum time in between flushes of the JIT memory dump in seconds.
```

And lastly for GC related options:

```shell
$ ~/dev/WebKit/WebKitBuild/Debug/bin/jsc --options 2>&1 | grep -i gc
   repatchBufferingCountdown=8
   bytecodeRangeToDFGCompile=<null>   ... bytecode size range to allow DFG compilation on, e.g. 1:100
   logCompilationChanges=false
   validateDoesGC=true
   reportDFGCompileTimes=false   ... dumps JS function signature and the time it took to DFG and FTL compile
   useGenerationalGC=true
   useConcurrentGC=true
   criticalGCMemoryThreshold=0.8   ... percent memory in use the GC considers critical.  The collector is much more aggressive above this threshold
   concurrentGCMaxHeadroom=1.5
   concurrentGCPeriodMS=2
   minimumGCPauseMS=0.3
   gcPauseScale=0.3
   gcIncrementBytes=10000
   gcIncrementMaxBytes=100000
   gcIncrementScale=0
   numberOfDFGCompilerThreads=2
   priorityDeltaOfDFGCompilerThreads=0
   maximumInliningCallerBytecodeCost=10000
   numberOfGCMarkers=8
   useParallelMarkingConstraintSolver=true
   slowPathAllocsBetweenGCs=0   ... force a GC on every Nth slow path alloc, where N is specified by this option
   sweepSynchronously=false   ... debugging option to sweep all dead objects synchronously at GC end before resuming mutator
   logGC=None   ... debugging option to log GC activity (0 = None, 1 = Basic, 2 = Verbose)
   useGC=true
   gcAtEnd=false   ... If true, the jsc CLI will do a GC before exiting
   forceGCSlowPaths=false   ... If true, we will force all JIT fast allocations down their slow paths.
   forceDidDeferGCWork=false   ... If true, we will force all DeferGC destructions to perform a GC.
   gcMaxHeapSize=0
   recordGCPauseTimes=false
   numberOfGCCyclesToRecordForVerification=3
   validateDFGClobberize=false   ... Emits extra validation code in the DFG/FTL for the Clobberize phase
```

The options that are relevant to your use case depend on what you want to do, but my hope is that you have already found something useful here or that you now know how to find what you need. Good luck!