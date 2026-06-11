---
title: "05 Functional Languages"
date: 2026-04-25
tags: ["programming-languages"]
draft: false
---

The core question of the functional languages chapter is: what happens to programming languages when "functions" are placed at the center of the language, rather than "state modification" at the center of the program.

In imperative programming, programs are typically understood as a sequence of commands:

```text
Change variables
Update state
Execute loops
Modify objects
```

Functional programming is more concerned with expressions, function composition, value transformations, and referential transparency. It cares about:

* Whether functions can be passed around like ordinary values
* Whether data can remain immutable
* Whether an expression can be replaced by its value
* Whether evaluation order affects results
* Whether function calls can be cached
* Whether code itself can be treated as data

This chapter is not just about introducing languages like Lisp, Scheme, ML, and Haskell, but also about discussing a different way of organizing programs.

## Lambda Calculus

The foundational mathematical formalism of functional programming is lambda calculus.

Lambda calculus expresses computation using a very small set of rules:

* Variables
* Function abstraction
* Function application

For example:

```text
λx. x + 1
```

Represents a function that receives `x` and returns `x + 1`.

Function application is:

```text
(λx. x + 1) 3
```

The result is:

```text
4
```

The importance of lambda calculus: it demonstrates that "function definition" and "function call" alone are sufficient to express computation. The core semantics of many functional languages can be traced back to this model.

## Distinctive Features of Functional Programming

Functional programming languages typically share some common features, though not every language possesses all of them.

Common features include:

* Functions are first-class values.
* Tendency to use pure functions.
* Tendency to use immutable data.
* Emphasis on referential transparency.
* Describing computation through expression composition.
* Common use of recursion and higher-order functions instead of explicit loops.
* Some languages support lazy evaluation, such as Haskell.
* Some languages have powerful type inference, such as ML, OCaml, Haskell.

Note: not all functional languages are lazy. Many languages like Scheme, ML, OCaml, and F# default to eager evaluation.
Also, not all functional languages completely lack state modification. Many languages allow mutation, but the functional style strives to minimize or isolate it.

## First-Class Value

A `first-class value` means a value can be used like ordinary data.

If functions are first-class values, it means functions can:

* Be assigned to variables
* Be passed as arguments to other functions
* Be returned as return values
* Be stored in data structures
* Be created at runtime

For example, JavaScript:

```js
const addOne = x => x + 1;

function apply(f, x) {
    return f(x);
}

apply(addOne, 3);
```

Here `addOne` is a function, but it is passed to `apply` like an ordinary value.

First-class functions are the foundation of functional programming. Without them, it is hard to naturally write higher-order functions, callbacks, map/filter/reduce, and similar structures.

## Higher-Order Functions

If a function receives a function as an argument, or returns a function, it is a higher-order function.

For example:

```js
const numbers = [1, 2, 3];

numbers.map(x => x + 1);
```

`map` receives a function and applies it to every element in the array.

The significance of higher-order functions: programs can pass "behavior" as values.

This allows many repetitive patterns to be abstracted:

* Traversal
* Filtering
* Aggregation
* Callbacks
* Strategy selection
* Deferred execution

For example:

```js
numbers.filter(x => x > 1)
       .map(x => x * 2)
       .reduce((a, b) => a + b, 0);
```

This code cares about how data transforms, not manually writing loops and updating temporary variables.

## Pure Functions

A pure function satisfies two conditions:

1. Same input always yields the same output.
2. No side effects.

For example:

```text
f(x) = x + 1
```

This is a pure function. As long as the input is `3`, the output is always `4`.

But the following is not pure:

```js
let counter = 0;

function next() {
    counter += 1;
    return counter;
}
```

It depends on and modifies external state. Even with no parameters, multiple calls yield different results.

The benefits of pure functions:

* Easy to test.
* Easy to reason about.
* Easy to cache.
* More suitable for concurrency.
* Easier for the compiler to optimize.

But real programs must handle side effects like I/O, time, random numbers, networking, and databases. So functional languages typically do not completely eliminate side effects, but manage them through type systems, monads, effect systems, runtime conventions, etc.

## Immutability

Functional programming generally prefers immutable data -- that is, data, once created, is never modified.

For example, if you want to "modify" a list, you typically do not mutate it in place, but create a new list.

```text
old list -> new list
```

The benefits of immutability include:

* Less prone to shared-mutable-state bugs.
* Multi-threaded reads are safer.
* Easier to implement persistent data structures.
* Easier to understand what a value means in the program.
* Function calls won't secretly change the same object.

Its cost: if not implemented well, it can produce a lot of copying.
So functional languages typically use persistent data structures, reducing copying costs through structural sharing.

## Referential Transparency

`Referential transparency` means an expression can be replaced by its computed result without changing program behavior.

For example:

```text
2 + 3
```

Can be replaced with:

```text
5
```

Program behavior is unchanged.

If a function is pure, then function calls can also be replaced by their results.

For example:

```text
square(3)
```

If `square` is a pure function, it can be replaced with:

```text
9
```

The benefit of referential transparency is that programs are easier to reason about. You don't need to worry about whether this expression secretly modified a global variable, wrote a file, sent a network request, or depended on the current time.

This is also one reason functional programming brings programs closer to mathematical expression.

## Lisp / Scheme REPL

Lisp and Scheme emphasized interactive development early on. REPL is read-eval-print loop.

It does four things:

1. Read: reads the expression entered by the user.
2. Eval: evaluates the expression.
3. Print: prints the evaluation result.
4. Loop: returns to the first step, continuing to wait for input.

For example:

```scheme
> (+ 1 2)
3
```

REPL lets programmers incrementally test expressions, functions, and data structures. It is very helpful for exploratory programming, teaching, and debugging.

## let, let*, and letrec in Scheme

`let`, `let*`, and `letrec` in Scheme are all used for local bindings, but their binding rules differ.

### let

`let` is parallel binding. The initial values of multiple variables are computed in the same outer environment; they cannot see each other's new bindings.

For example:

```scheme
(let ((x 1)
      (y 2))
  (+ x y))
```

Here `x` and `y` are bound simultaneously.

If written:

```scheme
(let ((x 1)
      (y x))
  y)
```

The `x` in `y`'s initialization expression does not refer to the newly bound `x` within the same `let`, but looks to the outer environment.

### let*

`let*` is sequential binding. Variables are bound in order; later bindings can see earlier bindings.

For example:

```scheme
(let* ((x 1)
       (y x))
  y)
```

Here `y` can see the just-bound `x`, so the result is `1`.

### letrec

`letrec` is used for recursive binding. It allows bindings to reference each other, commonly used for defining recursive or mutually recursive functions.

For example:

```scheme
(letrec ((fact
          (lambda (n)
            (if (= n 0)
                1
                (* n (fact (- n 1)))))))
  (fact 5))
```

`fact` can reference itself within its own function body.

A simple comparison:

```text
let    = parallel binding
let*   = sequential binding
letrec = recursive binding
```

## eq?, eqv?, and equal?

Equality in Scheme also has levels.

### eq?

`eq?` is typically used to determine whether two objects are the same object -- i.e., identity / pointer-level equality.

It is close to "do they point to the same thing."

For example, for symbols, `eq?` is typically very useful:

```scheme
(eq? 'a 'a)
```

### eqv?

`eqv?` is more suitable than `eq?` for comparing some basic values, such as numbers and characters.

It roughly determines whether two values represent the same simple value. For example, numbers with the same numeric value, identical characters -- `eqv?` is more reasonable.

### equal?

`equal?` leans more toward structural equality. It recursively compares the contents of composite structures.

For example, two lists with the same content, even if they are not the same object, `equal?` may consider them equal.

A rough memory aid:

```text
eq?     = identity
eqv?    = identity + simple value equality
equal?  = structural equality
```

## How Scheme Deviates from the Purely Functional Model

Scheme is a functional language, but not a purely functional one. It allows some operations that deviate from the purely functional model.

Common ones include:

* Mutation, e.g., `set!`
* Mutable pairs or vectors
* I/O operations
* Assignment
* Continuation-related control flow
* Interaction with external state

For example:

```scheme
(define x 1)
(set! x 2)
```

This modifies the value of an existing binding.

Scheme's character: it supports functional programming but does not force all programs to remain purely functional.

## Homoiconicity

`Homoiconic` means code and data use the same structural representation.

Lisp is the most classic example. Lisp programs are themselves list structures.

For example, the expression:

```scheme
(+ 1 2)
```

Is both a piece of code and can also be treated as list data:

```scheme
'(+ 1 2)
```

Because code is data, programs can naturally generate, modify, and analyze other programs.

This makes Lisp's macro system very powerful.

The significance of homoiconicity:

* Programs can manipulate programs.
* Macros are more natural.
* Strong metaprogramming capabilities.
* Close distance between language syntax and AST.

## S-expression

S-expression is short for symbolic expression -- the basic representation of Lisp code and data.

An S-expression can be an atom or a list.

Atom examples:

```scheme
x
42
"hello"
```

List example:

```scheme
(+ 1 2)
(define x 3)
(lambda (x) (+ x 1))
```

Lisp programs are essentially composed of S-expressions.
This is also why Lisp code has so many parentheses: parentheses directly represent tree structure.

## eval and apply

`eval` and `apply` are important concepts for understanding Lisp/Scheme's evaluation model.

### eval

`eval` receives an expression and evaluates it in some environment.

It answers:

```text
What is the value of this expression?
```

For example:

```scheme
(eval '(+ 1 2))
```

Yields:

```text
3
```

### apply

`apply` receives a function and a set of arguments, and applies the function to those arguments.

It answers:

```text
What do you get when applying this function to these arguments?
```

For example:

```scheme
(apply + '(1 2 3))
```

Yields:

```text
6
```

Simply put:

```text
eval  = evaluate the value of an expression
apply = call a function with arguments
```

## Function and Special Form

In Scheme, an ordinary function call typically first evaluates all arguments, then passes the results to the function.

For example:

```scheme
(+ 1 2)
```

`1` and `2` are evaluated, then passed to `+`.

But a special form has its own evaluation rules. It does not simply evaluate all arguments first.

For example:

```scheme
(if condition then-expr else-expr)
```

`if` only evaluates one branch based on the condition's result. If it were an ordinary function, both then and else would be evaluated first, which would violate the semantics of conditional expressions.

Common special forms include:

* `if`
* `define`
* `lambda`
* `quote`
* `set!`
* `let`

The significance of special forms is that they let the language define special control structures and binding structures.

## Normal-Order Evaluation and Applicative-Order Evaluation

Evaluation strategy determines when function arguments are computed.

### Applicative-Order Evaluation

Applicative-order evaluation, also called eager evaluation, first computes all actual parameters, then calls the function.

Most mainstream languages default to this strategy, e.g., C, Java, Python, JavaScript, Scheme.

For example:

```text
f(g(), h())
```

In applicative order, `g()` and `h()` are computed first, then `f` is called.

Pros:

* Direct behavior.
* Relatively simple to implement.
* Performance is relatively predictable.
* Easier to combine with side-effect languages.

Cons:

* Even if a parameter is never used in the function body, it is still computed.
* May be unable to express certain short-circuit or infinite structures.

### Normal-Order Evaluation

Normal-order evaluation passes the parameter expressions into the function, evaluating them only when truly needed.

For example:

```text
f(expensive())
```

If `f` never uses this parameter, `expensive()` is never executed.

Pros:

* Can avoid unnecessary computation.
* Can handle certain infinite data structures.
* Closer to the mathematical model of call-by-need.

Cons:

* If the same parameter is used multiple times, the expression may be recomputed.
* More complex to implement.
* Harder to understand when combined with side effects.

## Lazy Evaluation

Lazy evaluation can be seen as an improvement on normal-order evaluation: parameters are computed only the first time they are needed, and the result is cached. When the same parameter is used again later, the cached result is used directly.

So the characteristic of lazy evaluation is:

```text
need it -> compute once -> remember it
```

The key difference from normal-order is whether the result is cached.

Pros of lazy evaluation:

* Avoids unnecessary computation.
* Supports infinite data structures.
* Allows writing more compositional dataflow code.
* Same expression is not recomputed.

Cons:

* Evaluation timing is non-intuitive.
* Space usage is harder to predict.
* May produce thunk accumulation.
* Debugging performance issues is more difficult.

Haskell is a typical lazy functional language. Many other functional languages default to eager but can also achieve deferred evaluation through lazy constructs or thunks.

## Strict Function

A function is `strict` if: when its argument cannot produce a value, the function itself also cannot produce a value.

More formally, if the argument is bottom (non-terminating or erroneous), the strict function's result is also bottom.

A simple understanding:

```text
A strict function needs to obtain the argument value before it can produce its own result
```

For example, ordinary addition is strict:

```text
x + 1
```

If `x` itself is a non-terminating computation, then `x + 1` also does not terminate.

But structures like `if` are not strict in all branches. It only needs the condition, then evaluates only the selected branch.

This is why `if` is typically a special form, not an ordinary function.

## Memoization

`Memoization` means caching the results of function calls to avoid recomputation.

If a function is pure, the same input always yields the same output. This makes safe caching possible:

```text
Compute f(x) once
Later encounter f(x) again, directly return cached result
```

For example, Fibonacci recursion without caching recomputes many subproblems:

```text
fib(5)
= fib(4) + fib(3)
= fib(3) + fib(2) + fib(2) + fib(1)
...
```

Memoization can cache these repeated calls, greatly improving performance.

Its mechanism:

1. Check whether the arguments are already in the cache.
2. If so, directly return the cached result.
3. If not, compute the result.
4. Store the result in the cache.
5. Return the result.

Memoization's limitations:

* Requires extra memory.
* Arguments must serve as keys.
* Unsafe for functions with side effects.
* Cache strategy must be controlled, or it may grow without bound.

## Functional Programming and Concurrency

Pure functional languages are particularly attractive for concurrency because they reduce shared mutable state.

One of the hardest problems in concurrent programming is:

```text
Multiple threads simultaneously reading and writing the same piece of shared data
```

If data is immutable, many race conditions simply cannot occur. Multiple threads can safely share the same value because no thread will mutate it in place.

Pure functions are also easier to parallelize. Because function calls do not depend on hidden state, the compiler or runtime can more easily determine which computations can be performed simultaneously.

Of course, real programs still need I/O and external state. But functional languages can centralize effect management, making the pure computation parts easier to execute concurrently.

## Tradeoffs of Functional Programming

The advantages of functional programming are clear:

* Programs are easier to reason about.
* Less state change.
* Easier testing.
* Safer concurrency.
* Strong abstraction capability.
* Higher-order functions let repetitive control structures be encapsulated.

But it also has costs:

* The mindset is not intuitive for beginners.
* The performance model is sometimes unclear, especially with lazy evaluation.
* Excessive abstraction can reduce readability.
* Interacting with low-level systems, mutable state, and I/O requires extra mechanisms.
* Some scenarios produce extra allocations.

So the value of functional programming is not turning every program into a mathematical formula, but providing a way to more easily control state and compose logic.

## Summary

The Functional Languages chapter can be threaded together with several sets of questions:

1. If functions are first-class values, how does program structure change?
2. Why are pure functions easier to test, cache, and make concurrent?
3. How does immutability reduce problems from shared state?
4. Why does referential transparency make programs easier to reason about?
5. Why can Lisp/Scheme treat code as data?
6. What are the differences in binding rules among `let`, `let*`, and `letrec`?
7. What are `eq?`, `eqv?`, and `equal?` each comparing?
8. What steps in the evaluation model do `eval` and `apply` each represent?
9. What is the difference among eager, normal-order, and lazy evaluation?
10. How does strictness describe a function's dependency on argument evaluation?
11. Why does memoization depend on the properties of pure functions?

The key point of functional programming is understanding computation as the composition of values and functions, rather than a sequence of state modifications. Through first-class functions, immutability, referential transparency, and controlled effects, it makes programs easier to reason about and compose. It also reminds us: language design does not have only the imperative path; computation can be organized around expressions, functions, and evaluation strategies.
