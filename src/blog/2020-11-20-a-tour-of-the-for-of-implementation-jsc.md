---
title: A tour of the `for..of` implementation for 32bits JSC
description: We look at the implementation of the `for-of` intrinsic in 32bit JSC (javascriptCore).
tags: ["webkit", "igalia"]
date: 2020-11-20
layout: article.njk
permalink: "blog/{{ title | slugify }}.html"
---

## Context

On April 18, 2020, Keith Miller from Apple committed a change titled [Redesign how we do for-of iteration for JSArrays](https://trac.webkit.org/changeset/260323/webkit). This patch adds an intrinsic for the `for-of` javascript construct when they are being iterated with the built-in `Symbol.iterator`. However, the implementation is only for 64 bit architectures. At [Igalia](https://www.igalia.com), we maintain and support javascriptCore 32bits so on July 29, 2020, [I committed support](https://trac.webkit.org/changeset/265036/webkit) for the `for-of` intrinsics work on 32 bit architectures as joint work with [Caio Lima](https://caiolima.github.io/).

In this blog post, I will attempt to give an overview of the implemented changes in revision [r265036](https://trac.webkit.org/changeset/265036/webkit) of WebKit which extends support of the `for-of` intrinsics work to 32 bits. For the purposes of brevity I will focus on the iterator open intrinsic.

## Overview

JSC consists of several tiers (compilation layers). These tiers start with LLInt (the Low-Level Interpreter), followed by the Baseline JIT, DFG (Data Flow Graph JIT), and FTL (Faster-Than-Light JIT). We will not discuss FTL here since we do not run the FTL tier for 32 bits.

The patch for [r265036](https://trac.webkit.org/changeset/265036/webkit) touches architecture specific files, like [MacroAssemblerARMv7.h](https://trac.webkit.org/browser/webkit/trunk/Source/javascriptCore/assembler/MacroAssemblerARMv7.h?rev=265036) and [MacroAssemblerMIPS.h](https://trac.webkit.org/browser/webkit/trunk/Source/javascriptCore/assembler/MacroAssemblerMIPS.h?rev=265036), however these changes are less relevant as we just add a couple of functions for emitting octet load/store instructions (`store8`, `or8`, etc). Instead, we will focus on changes to the tiers starting with the changes to LLInt.

## javascript and for-of

I guess as Compiler Engineers we should try to understand what we have to implement first. Lets try to use an iterator implicitly through a [`for-of` loop](https://developer.mozilla.org/en-US/docs/Web/javascript/Reference/Statements/for...of).

```javascript
const a = ["a", "b", "c"];
for (const value of a) {
  console.log(value);
}
// =>
// "a"
// "b"
// "c"
```

The `for-of` statement gets an iterator from the array behind the scenes and loops through its values assigning them one by one to the variable `value`.

If we were to look at using the iterator explicitly, the above loop would be transformed to:

```javascript
const a = ["a", "b", "c"];
const it = a[Symbol.iterator]();
let result = it.next();
while (!result.done) {
  console.log(result.value);
  result = it.next();
}
```

So the symbol `Symbol.iterator` returns a method that when called returns an iterator. This iterator has a `next` function to get a result object. The result object has a `done` property indicating if we are done iterating and a value which is the current value in the iteration. There's something to keep in mind though. The `done` property is optional if its value would be `false` and the `value` property is optional if its value would be `undefined`.

Armed with this knowledge, [revision 260323](https://trac.webkit.org/changeset/260323/webkit) which implements `for-of` intrinsics for 64 bits, makes a lot more sense. It implements two intrinsics `op_iterator_open` and `op_iterator_next`. The commit message explains the semantics of each operator as follows:

* The `op_iterator_open` bytecode is semantically the same as:

```
iterator = symbolIterator.@call(iterable);
next = iterator.next;
```
where iterable is the rhs of the `for-of` and `symbolIterator` is the result of running `iterable.symbolIterator`;

* The `op_iterator_next` bytecode is semantically the same as:

```
nextResult = next.@call(iterator);
done = nextResult.done;
value = done ? (undefined / bottom) : nextResult.value;
```

where `nextResult` is a temporary (the value `VirtualRegister` in the LLInt/Baseline and a `tmp` in the DFG);

We can now proceed to understand how to implement these on 32bits.

## LLInt

LLInt is a bytecode interpreter implemented using a DSL (Domain Specific Language). The compiler for it is [implemented in Ruby](https://github.com/WebKit/webkit/tree/master/Source/javascriptCore/offlineasm). The `offlineasm` compiler reads this DSL and outputs a bytecode interpreter in native assembler, for a few supported architectures, or cpp. The cpp backend is known as Cloop and if you enable it, to for example compile JSC for an IBM System Z9, the JSC build system generates the cpp interpreter, compiles it and then links it with JSC. If you do enable Cloop, then none of the remaining JIT tiers are available. This is as much as we will discuss about Cloop as both ARMv7 and MIPS have LLInt support, so from here on out we will assume we are working with the native assembly backend for `offlineasm`.

The source code for LLInt (input to `offlineasm`) lives in [`WebKit/Source/javascriptCore`](https://github.com/WebKit/webkit/tree/master/Source/javascriptCore/llint). The entry point is at [`LowLevelInterpreter.asm`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/llint/LowLevelInterpreter.asm) and it starts with a bunch of constant definitions followed by something you'll see often: a macro.

At the time of writing, the first one is [`nextInstruction`](https://github.com/WebKit/webkit/blob/ce2bff038035bac33352237652d33ff795a69959/Source/javascriptCore/llint/LowLevelInterpreter.asm#L319):

```ruby
macro nextInstruction()
    loadb [PB, PC, 1], t0
    leap _g_opcodeMap, t1
    jmp [t1, t0, PtrSize], BytecodePtrTag
end
```

Each time you call elsewhere `nextInstruction` (which actually starts processing the next bytecode), the call will be replaced by the three (low-level) instructions in the body of the macro. These instructions `loadb`, `leap` and `jmp` are defined on per-architecture in [`arm.rb`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/offlineasm/arm.rb), [`arm64.rb`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/offlineasm/arm64.rb), [`arm64e.rb`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/offlineasm/arm64e.rb), [`mips.rb`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/offlineasm/mips.rb), and [`x86.rb`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/offlineasm/x86.rb). Listing of all available instructions are in [`instructions.rb`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/offlineasm/instructions.rb).

So for 32bits arm:

* the `loadb` will generate a [`ldrb`](https://github.com/WebKit/webkit/blob/b63199a0f04a5f7a435cb91e914419d2fd4f50d7/Source/javascriptCore/offlineasm/arm.rb#L447),
* the `leap` will generate a [load effective address](https://github.com/WebKit/webkit/blob/b63199a0f04a5f7a435cb91e914419d2fd4f50d7/Source/javascriptCore/offlineasm/arm.rb#L659) through an `add` whose format depends on the first operand of `leap`, and
* the `jmp` will generate either a [`b` or `mov` instruction](https://github.com/WebKit/webkit/blob/b63199a0f04a5f7a435cb91e914419d2fd4f50d7/Source/javascriptCore/offlineasm/arm.rb#L597) which depends on if the first operand of `jmp` is a label. 

The compilation of this DSL to assembler is done during JSC build-time which means that by the time the interpreter is called there's no execution of ruby code.

Lets start by implementing the bytecode `op_iterator_open`, which before looked like this in [`LowLevelInterpreter32_64.asm`](https://github.com/WebKit/webkit/blob/99cee626c89e192a5fd211b6ba59be68b40c310b/Source/javascriptCore/llint/LowLevelInterpreter32_64.asm#L2645):

```
llintOp(op_iterator_open, OpIteratorOpen, macro (size, get, dispatch)
    defineOSRExitReturnLabel(op_iterator_open, size)
    break
    if C_LOOP or C_LOOP_WIN
        # Insert superflous call return labels for Cloop.
        cloopCallJSFunction a0 # symbolIterator
        cloopCallJSFunction a0 # get next
    end
end)
```

Before proceeding a clarification of what this is. This is essentially a top-level call to the macro `llintOp` with three arguments:

1. `op_iterator_open`,
2. `OpIteratorOpen`, and
3. `macro(size, get, dispatch) ... end`

Argument `3` is an anonymous macro passed as a first-class citizen to `llintOp` which can then call it. The macro `llintOp` is defined in [`LowLevelInterpreter.asm`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/llint/LowLevelInterpreter.asm) and the declaration looks like:

```
macro llintOp(opcodeName, opcodeStruct, fn)
```

The anonymous macro defined in the `op_iterator_open` is passed to the `llintOp` macro and can be called as `fn(...)`. Most of the code organization in LLInt is like this and you should get used to reading it.

As we require access to the metadata for the implementation of `op_iterator_open` we change the declaration slightly and add a few commonly defined macros:

```
llintOpWithMetadata(op_iterator_open, OpIteratorOpen, macro (size, get, dispatch, metadata, return)
    macro fastNarrow()
        callSlowPath(_iterator_open_try_fast_narrow)
    end
    macro fastWide16()
        callSlowPath(_iterator_open_try_fast_wide16)
    end
    macro fastWide32()
        callSlowPath(_iterator_open_try_fast_wide32)
    end
    size(fastNarrow, fastWide16, fastWide32, macro (callOp) callOp() end)
    bbeq r1, constexpr IterationMode::Generic, .iteratorOpenGeneric
    dispatch()
```

There are two execution paths that can be taken at this point:

1. Fast path: this path is currently implemented in cpp and the code resides in [`CommonSlowPaths.cpp:iterator_open_try_fast`](https://github.com/WebKit/webkit/blob/89ece25c12467354e836b224948db00fc21edf11/Source/javascriptCore/runtime/CommonSlowPaths.cpp#L856). If it succeeds then the branch `bbeq` is not taken and the control flow dispatches to execute the next bytecode instruction.
2. Slow path: the generic path is taken if the fast path fails. If it fails, then it [sets `r1` with the value `constexpr IterationMode::Generic`](https://github.com/WebKit/webkit/blob/89ece25c12467354e836b224948db00fc21edf11/Source/javascriptCore/runtime/CommonSlowPaths.cpp#L898). In the 32bits ABI `r1` is the tag of the return value.

All the code that follows is part of the slow path and the next step is:

```
.iteratorOpenGeneric:
    macro gotoGetByIdCheckpoint()
        jmp .getByIdStart
    end

    macro getCallee(dst)
        get(m_symbolIterator, dst)
    end

    macro getArgumentIncludingThisStart(dst)
        getu(size, OpIteratorOpen, m_stackOffset, dst)
    end

    macro getArgumentIncludingThisCount(dst)
        move 1, dst
    end

    callHelper(op_iterator_open,                    # opcodeName
               _llint_slow_path_iterator_open_call, # slowPath
               OpIteratorOpen,                      # opcodeStruct
               m_iteratorProfile,                   # valueProfileName
               m_iterator,                          # dstVirtualRegister
               prepareForRegularCall,               # prepareCall
               size,                                # size
               gotoGetByIdCheckpoint,               # dispatch
               metadata,                            # metadata
               getCallee,                           # getCallee
               getArgumentIncludingThisStart,       # getArgumentStart
               getArgumentIncludingThisCount)       # getArgumentCountIncludingThis
```

Here we define a few helper macros required by `callHelper`. I have commented on the `callHelper` call with all the argument names to ease understanding what the function does. This is a helper function to simplify the call to the method stored in the `Symbol.Iterator` property.

The implementation of the `op_iterator_open` in LLInt ends up with:

```
.getByIdStart:
	macro storeNextAndDispatch(valueTag, valuePayload)
        move valueTag, t2
        move valuePayload, t3
        get(m_next, t1)
        storei t2, TagOffset[cfr, t1, 8]
        storei t3, PayloadOffset[cfr, t1, 8]
 	    dispatch()
 	end

    # We need to load m_iterator into t3 because that's where
 	# performGetByIDHelper expects the base object   
 	loadVariable(get, m_iterator, t3, t0, t3)
 	bineq t0, CellTag, .iteratorOpenGenericGetNextSlow
 	performGetByIDHelper(OpIteratorOpen,                  # opcodeStruct
                         m_modeMetadata,                  # modeMetadataName
                         m_nextProfile,                   # valueProfileName
                         .iteratorOpenGenericGetNextSlow, # slowLabel
                         size,                            # size
                         metadata,                        # metadata
                         storeNextAndDispatch)            # return

.iteratorOpenGenericGetNextSlow:
 	callSlowPath(_llint_slow_path_iterator_open_get_next)
 	dispatch()
end)
```

The `callHelper` above placed an iterator in register `t3`, so we check what type of tag the iterator has. If the iterator is not a cell (tagged with `CellTag` - a cell is essentially anything that's heap allocated) then we jump to the slow path. If, however, the iterator is an object we call `storeNextAndDispatch` through `performGetByIDHelper` which does a few useful checks. `storeNextAndDispatch` initializes the iterator and dispatches to the next bytecode.

The `op_iterator_next` will follow the same pattern but instead implement the semantics of `iterator.next`. Next we will see how a similar pattern is implemented in the Baseline JIT compiler.

## Baseline

The Baseline JIT source code lives inside [Source/javascriptCore/jit](https://github.com/WebKit/webkit/tree/master/Source/javascriptCore/jit). The part of the JIT compiler the deals with 32 bit platforms, mostly lives in [Source/javascriptCore/jit/JITCall32_64.cpp](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/jit/JITCall32_64.cpp). It is responsible to generate assembly code for a given bytecode stream as input. This explains the resemblances we have between LLInt operations, since we need to emit code that has the same semantics as the LLInt operation. This compiler applies barely any compiler optimizations, since the goal is to generate binary code as quickly as it can and its major gain on performance is due to the removal of LLInt instruction dispatch.
The Baseline compiler is a heavy user of JSC’s AssemblerHelpers. This is an essential API that’s used to abstract the code generation for the multiple architectures JSC supports and also abstracts some operations that are quite common on LLInt like `branchIfNotCell` or `branchIfNotEmpty`.  It also implements a set of operations that are very helpful when we need to implement JIT support for a new opcode, such as `emitGetVirtualRegister`, `emitPutVirtualRegister`, and `callOperation`.

Lets look at how we implement the functions `emit_op_iterator_open`, `emitSlow_op_iterator_open` and the corresponding `next` versions of those.

```cpp
void JIT::emit_op_iterator_open(const Instruction* instruction)
{
    auto bytecode = instruction->as<OpIteratorOpen>();
    auto* tryFastFunction = ([&] () {
        switch (instruction->width()) {
        case Narrow: return iterator_open_try_fast_narrow;
        case Wide16: return iterator_open_try_fast_wide16;
        case Wide32: return iterator_open_try_fast_wide32;
        default: RELEASE_ASSERT_NOT_REACHED();
        }
    })();

    JITSlowPathCall slowPathCall(this, instruction, tryFastFunction);
    slowPathCall.call();
    Jump fastCase = branch32(NotEqual, GPRInfo::returnValueGPR2, TrustedImm32(static_cast<uint32_t>(IterationMode::Generic)));
```

It is not hard to see some resemblance between this code and the one shown for LLInt's `op_iterator_open`. Once again we see if we can apply the fast case of this iterator and if not, we call the slow path. 

```cpp
    compileOpCall<OpIteratorOpen>(instruction, m_callLinkInfoIndex++);

    advanceToNextCheckpoint();
    
    // call result (iterator) is in regT1 (tag)/regT0 (payload)
    const Identifier* ident = &vm().propertyNames->next;
    
    emitJumpSlowCaseIfNotJSCell(regT1);
```

The result of the call to the `Symbol.iterator` method is again split, in 32bits machines, between a tag (in `regT1`) and a payload (in `regT0`). We jump to the slow case if the result is not a cell. 

```cpp
    GPRReg tagIteratorGPR = regT1;
    GPRReg payloadIteratorGPR = regT0;

    GPRReg tagNextGPR = tagIteratorGPR;
    GPRReg payloadNextGPR = payloadIteratorGPR;

    JITGetByIdGenerator gen(
        m_codeBlock,
        CodeOrigin(m_bytecodeIndex),
        CallSiteIndex(BytecodeIndex(m_bytecodeIndex.offset())),
        RegisterSet::stubUnavailableRegisters(),
        CacheableIdentifier::createFromImmortalIdentifier(ident->impl()),
        JSValueRegs(tagIteratorGPR, payloadIteratorGPR),
        JSValueRegs(tagNextGPR, payloadNextGPR),
        AccessType::GetById);
```

At this point we generate the access to the `next` property of the iterator and ensure it is initialized.

```cpp
    gen.generateFastPath(*this);
    addSlowCase(gen.slowPathJump());
    m_getByIds.append(gen);

    emitValueProfilingSite(bytecode.metadata(m_codeBlock));
    emitPutVirtualRegister(bytecode.m_next, JSValueRegs(tagNextGPR, payloadNextGPR));

    fastCase.link(this);
}
```

The function finishes with some boilerplate code for linking and site profiling. However, most importantly it ensures that the values for the next bytecode are put into the correct registers in order for execution to continue. This function also shows a usage of another important kind of helper: branch instructions. Lets refocus just on the important pieces of `emit_op_iterator_open` the branch helper usage.

```
void JIT::emit_op_iterator_open(const Instruction* instruction)
{
    // ...
    JITSlowPathCall slowPathCall(this, instruction, tryFastFunction);
    slowPathCall.call();
    Jump fastCase = branch32(NotEqual, GPRInfo::returnValueGPR2, TrustedImm32(static_cast<uint32_t>(IterationMode::Generic)));
    // ...
    fastCase.link(this);
}
```

The code above will generate assembly code that branches to the end of `emit_op_iterator_open` if `returnValueGPR2` is not equal to `IterationMode::Generic`. The branch jumps to where we are linking `fastCase`.

Another kind of very useful helpers are `JITSlowPathCall slowPathCall(this, instruction, tryFastFunction)`, `callOperation` and variants of these. That is because they abstract the ABI of each architecture to perform calls to cpp functions. On JSC we have a set of cpp functions that we call `JITOperations` and are used by JIT when something is very complex to be done from assembly directly. For example, `emit_op_iterator_open` uses these to call on `iterator_open_try_fast_narrow`, `iterator_open_try_fast_wide16`, or `iterator_open_try_fast_wide32`. Also `emitSlow_op_iterator_open` calls on `callOperation(operationThrowIteratorResultIsNotObject, TrustedImmPtr(m_codeBlock->globalObject()));`.

When discussing `emit_op_iterator_open` in baseline JIT, we saw above the usage of `JITGetByIdGenerator` to generate assembly code to access the property `next` from the iterator object. This class is a very useful as it encapsulates the Inline Cache (IC) mechanism for property access on JSC. It takes registers for base object where the `Get` operation is going to be performed (`tagIteratorGPR` and `payloadIteratorGPR`) in addition to where the result of such access will be placed (`tagNextGPR` and `payloadNextGPR`). The code for fast path is generated by `gen.generateFastPath(*this);` and since IC is only filled after its execution, the generation of fast path is a set of “noop” that eventually will  be repatched by fast code that accesses cached properties. We also configure `slowPathJump` for this generator and this is important because when IC is empty, we always take the slow path to perform the `Get` operation and configure the cache for it. 

The following code shows the `iterator_open` slow path and where the `JITGetByIdGenerator` is linked into when jumping to it.

```
void JIT::emitSlow_op_iterator_open(const Instruction* instruction, Vector<SlowCaseEntry>::iterator& iter)
{
    // …
    linkAllSlowCases(iter);

    GPRReg tagIteratorGPR = regT1;
    GPRReg payloadIteratorGPR = regT0;

    JumpList notObject;
    notObject.append(branchIfNotCell(tagIteratorGPR));
    notObject.append(branchIfNotObject(payloadIteratorGPR));

    auto bytecode = instruction->as<OpIteratorOpen>();
    VirtualRegister nextVReg = bytecode.m_next;
    UniquedStringImpl* ident = vm().propertyNames->next.impl();

    JITGetByIdGenerator& gen = m_getByIds[m_getByIdIndex++];
    
    Label coldPathBegin = label();

    Call call = callOperationWithProfile(
        bytecode.metadata(m_codeBlock),                  // metadata
        operationGetByIdOptimize,                        // operation
        nextVReg,                                        // result
        TrustedImmPtr(m_codeBlock->globalObject()),      // arg1
        gen.stubInfo(),                                  // arg2
        JSValueRegs(tagIteratorGPR, payloadIteratorGPR), // arg3
        CacheableIdentifier::createFromImmortalIdentifier(ident).rawBits()); // arg4
    
    gen.reportSlowPathCall(coldPathBegin, call);
    auto done = jump();

    notObject.link(this);
    callOperation(operationThrowIteratorResultIsNotObject, TrustedImmPtr(m_codeBlock->globalObject()));

    done.link(this);
    //…
}
```

During the execution the code above, we first perform a type check to guarantee that the iterator is an object - otherwise we need to throw a “Result is not object” exception. Assuming then that iterator is indeed an object, we perform a call to the JIT operation `operationGetByIdOptimize`. This operation is responsible to check if the `Get` we are performing is cacheable and then buffer those cases to repatch the fast path once we have enough evidence that this is a hot operation.

The code for those generators lives on [`JITInlineCacheGenerator.h`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/jit/JITInlineCacheGenerator.h) and [`JITInlineCacheGenerator.cpp`](https://github.com/WebKit/webkit/blob/master/Source/javascriptCore/jit/JITInlineCacheGenerator.cpp). It includes generators for `op_in`, `op_put_by_id` and even for `op_get_by_val`. These generators are also used by DFG and FTL code, mainly when there’s not enough type information for some opcodes during compile time.

Lets look at `emit_op_iterator_next` in order to understand `emitGetVirtualRegister`.

```
void JIT::emit_op_iterator_next(const Instruction* instruction)
{
    //…
    JSValueRegs nextRegs(regT1, regT0);
    emitGetVirtualRegister(bytecode.m_next, nextRegs);
    //…
}
```

This operation loads the `next` operand into `regT1` and `regT0`. The call to `emitGetVirtualRegister` generates assembly code that loads a `JSValue` stored in a `VirtualRegister` into the machine register(s) we pass as a parameter. For both LLInt and Baseline JIT, virtual registers are always assigned to stack slots, which means that `emitGetVirtualRegister` will generate code that is going to load values from stack into machine registers. 

It is important to notice that `regT1` and `regT0` are aliases for registers of the architecture we are targetting. We also see the usage of `JSValueRegs`, which is an abstraction created to reuse code among 64-bits and 32-bits code. It abstracts the fact that JSValues are 64-bits long, which means that we need 2 registers (tag and payload) to manage a JSValue on 32-bits code.
Following helpers used by `emit_op_iterator_open`, we have `emitPutVirtualRegister` that is very similar with `emitGetVirtualRegister` but it stores a JSValue into a virtual register. A usage of this helper's counterpart `emitPutVirtualRegister` can be seen in the code for `emit_op_iterator_open`, which stores a `JSValue` into a virtual register.

## Conclusions

The important bits were the implementation of the intrinsics for LLInt and Baseline JIT. A few other code bits went into the patch but they are just ensuring everything works as expected instead of being large changes to the codebase.

Although the implementation of the intrinsic is essentially the implementation of the same semantics, they require quite different knowledge since they operate at different levels of abstraction. On the one hand, LLInt is written in a DSL that compiles down to assembler and essentially implements a language interpreter. On the other, the Baseline JIT is written in cpp an implements a JIT Compiler. The API between both is completely different which requires the developer to know both in order to implement a single feature. The implementation of this feature for 64bits required further changes to other tiers of JSC, which we didn't need to touch for 32bits. In 32bits we do not have FTL enabled and DFG is essentially platform agnostic.

## Thanks

My colleague [Caio Lima](https://caiolima.github.io/) has reviewed this post and spent a significant amount of time adding technical details where I initially had few. Any inaccuracies or lack of detail however, are still my own fault.