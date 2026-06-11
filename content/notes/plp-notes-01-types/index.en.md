---
title: "01 Type Systems"
date: 2026-04-21
tags: ["programming-languages"]
draft: false
---

The core question of the type systems chapter is: how does a language understand "what" a piece of data is, what operations it can perform, when should errors be discovered, and how can code be safely reused across different data.

Types can be thought of as a constraint system within a programming language. On one hand, they help programmers express intent; on the other, they help the compiler or runtime discover invalid operations. If a value is seen as `int`, it can participate in integer arithmetic; if seen as `string`, it can perform string concatenation, indexing, matching, etc. The same binary data, interpreted under different types, carries completely different meanings.

## The Role of Types

Types serve several purposes in programming languages:

* Tell the compiler or runtime how a piece of data should be interpreted, e.g., `int`, `float`, `string`, `bool`.
* Perform safety checks, preventing invalid operations, such as dividing a string by a number, or passing an object that lacks a required method to a function.
* Help determine memory allocation and data layout, e.g., how many bytes an `int` occupies, how a record is aligned.
* Provide abstraction, freeing programmers from caring about underlying binary details and only worrying about what operations a value supports.

So types are not simply labels. They simultaneously affect semantics, safety, memory representation, and program structure.

## Strongly Typed and Statically Typed

`Strongly typed` means the language strictly enforces type rules, restricting operations between incompatible types. For example, if a function expects an `Integer`, you cannot casually pass a `Boolean` or `String` unless the language explicitly permits a conversion.

`Statically typed` means type checking happens at compile time. Before the program runs, the compiler already knows the types of most expressions, variables, and function return values.

These two concepts are different:

* Java: typically strongly typed + statically typed.
* Python: typically strongly typed + dynamically typed.
* C: statically typed, but not very strong, because it allows many operations that bypass the type system.
* JavaScript: dynamically typed, with many implicit coercions and relatively loose type rules.

C is hard to call strictly strongly typed mainly because it allows:

* pointer casts
* pointer arithmetic
* unsafe unions
* interpreting memory of one type as another type

For example, in C you can use a cast to treat `int*` as `float*`. The compiler may warn or allow this, but it has already bypassed the type system itself.

## Type Clash

`Type clash` is a type mismatch error. For example, a function expects an `Integer` argument but you pass a `Boolean`; or an expression requires compatible types on both sides but they are incompatible.

The earlier the type system discovers a type clash, the easier the program is to debug. Statically typed languages typically discover them at compile time; dynamically typed languages at runtime.

## Three Ways of Understanding Types

Types can be understood from three perspectives: denotational, structural, and abstraction-based.

### Denotational View

The denotational view understands a type as a set of values.

For example:

* `bool = {true, false}`
* `int` is a set of values within some integer range
* An enum type is also a finite set of values

This perspective emphasizes: a value belongs to a certain set, therefore it belongs to a certain type.

### Structural View

The structural view focuses on the internal structure of types. Two types are considered the same or compatible if their structures match.

For example, two records both having:

```ts
{
  name: string
  age: number
}
```

In a structural type system, they may be considered objects of the same shape. TypeScript is very close to this approach.

### Abstraction-based View

The abstraction-based view focuses on what operations a type exposes, not how it is internally implemented.

For example, what really matters for a stack type may not be whether it internally uses an array or linked list, but that it supports:

* `push`
* `pop`
* `top`
* `isEmpty`

As long as the outside can correctly use it through these operations, it can be viewed as some kind of stack abstraction.

This perspective is closely related to ADTs, interfaces, and modules.

## Orthogonality

A set of language features has `orthogonality` when those features can be combined relatively independently, without too many special restrictions among them.

For example, if a language supports both arrays and pointers, and these two features are sufficiently orthogonal, it should naturally support:

* array of pointers
* pointer to array
* pointer to pointer
* array of arrays

The benefit of orthogonality is that language rules are more uniform, and programmers don't need to remember many special cases. The downside is that too many combinations can make the language complex, even producing some hard-to-understand edge behaviors.

## Aggregates

`Aggregates` are new types formed by combining multiple data items together. Common examples include:

* array
* record / struct
* tuple
* object

They allow languages to express more complex data structures. For example, `Point` can be composed of two numbers, and `Student` can be composed of name, ID, grades, and other fields.

## Option Types

`Option type` is used to express "there may be a value, or there may not be."

A typical form is:

```rust
Option<T> = Some(T) | None
```

Its purpose is to make "emptiness" explicit within the type system, rather than letting `null` propagate everywhere. This way the compiler can force the programmer to handle the absence case, reducing null pointer errors.

For example, a lookup function can return:

```rust
Some(value)
```

or:

```rust
None
```

The caller must handle both cases.

## Polymorphism

`Polymorphism` means the same piece of code, the same interface, can work with multiple types.

The most common forms are:

* parametric polymorphism
* subtype polymorphism
* ad hoc polymorphism
* duck typing

### Parametric Polymorphism

Parametric polymorphism means writing code without specifying concrete types, using type parameters instead.

For example:

```java
List<T>
```

Here `T` can be `String`, `Integer`, `User`, etc. The logic of the function or data structure remains consistent across different types.

Generics are usually the implementation of parametric polymorphism in a specific language. Their primary value: preserving type safety while reusing code.

### Subtype Polymorphism

Subtype polymorphism means a subtype can appear where a supertype is needed.

For example, if `Student` is a subtype of `Person`, then a function expecting a `Person` can also accept a `Student`.

This kind of polymorphism is usually related to inheritance, interfaces, and dynamic dispatch.

### Ad Hoc Polymorphism

Overloading is a typical form of ad hoc polymorphism.

For example:

```java
add(int a, int b)
add(double a, double b)
add(String a, String b)
```

They share the same name but may be different implementations. It is called ad hoc because this polymorphism is individually defined for specific type combinations, rather than automatically obtained through a unified type parameter.

## Generics vs. Overloading

Generics write one piece of logic for multiple types.

Overloading writes multiple pieces of logic for different types, merely sharing the same name.

For example, a generic function is more like:

```java
T identity(T x) {
    return x;
}
```

It does the same thing for any `T`.

Overloading is more like:

```java
print(int x)
print(String x)
print(User x)
```

They share the same name, but the function bodies can be completely different.

## Type Equivalence and Type Compatibility

`Type equivalence` asks whether two types are considered the same type by the language.

`Type compatibility` asks whether two types can be used together in certain contexts.

These two concepts should not be conflated.

For example, two types may not be equivalent, but may be compatible. An `int` and a `float` are not the same type, but some languages allow implicit conversion of `int` to `float`. This is compatibility, not equivalence.

### Structural Equivalence

Structural equivalence judges whether types are equivalent by their internal structure. As long as fields, field types, ordering, and other structural aspects match, they may be considered the same type.

Pros:

* Flexible
* Reduces redundant declarations
* Suitable for "if the shape matches, you can use it" scenarios

Examples:

* TypeScript's object types
* Some of OCaml's object types
* Go's interface satisfaction is close to the structural approach

### Name Equivalence

Name equivalence judges whether types are equivalent by name. Even if two types have the same structure, they may be treated as different types if their names differ.

Pros:

* Safer
* Better expresses programmer intent
* Prevents misuse of structurally identical but semantically different types

For example:

```c
type UserId = int
type ProductId = int
```

Structurally, they are both integers, but semantically they are completely different. Name equivalence can prevent using `UserId` as `ProductId`.

Common examples:

* Java's class types
* C++'s class / struct types
* Ada's type system

## Strict Name Equivalence and Loose Name Equivalence

`Strict name equivalence` means a new type definition creates a completely new, incompatible type. Even if the underlying structure is the same, they are not equivalent.

`Loose name equivalence` means a type alias merely gives an existing type a new name; both remain equivalent.

Simply put:

```text
strict: new name = new type
loose:  new name = alias of original type
```

The difference between the two is: whether the language treats this declaration as "defining a new type" or "defining an alias."

## Type Conversion, Type Coercion, and Nonconverting Casts

`Type conversion` is an explicit type conversion. The programmer clearly writes a conversion operation, which may change the underlying representation during conversion.

For example:

```c
(float) x
```

`Type coercion` is an implicit type conversion. The programmer does not explicitly write a conversion, but the compiler or runtime completes it automatically.

For example:

```c
int x = 1;
double y = x;
```

Here `int` may be automatically converted to `double`.

`Nonconverting type cast` does not change the underlying bits; it only changes the interpretation. It treats the same piece of memory as a different type. Such operations carry higher risk because they bypass normal type semantics.

## Arguments For and Against Coercion

Arguments for coercion:

* Reduces redundant code
* More convenient to write
* Some conversions are intuitive, e.g., `int` to `float`

Arguments against coercion:

* May hide bugs
* May cause precision loss
* Reduces code readability
* Program behavior becomes harder to predict

Many strange behaviors in weakly typed languages are related to coercion. For example, JavaScript's `==` triggers implicit conversion, so `"0" == 0` yields `true`. Such rules are sometimes convenient but can easily blur the meaning of equality.

## When Type Conversion Needs Run-Time Checks

When the compiler cannot determine at compile time that a conversion is definitely safe, a run-time check is necessary.

Common situations include:

* narrowing conversion
* downcasting
* subrange / refinement checks

### Narrowing Conversion

For example, converting from a larger-range type to a smaller-range type:

```text
float -> int
long -> short
```

This may cause overflow, truncation, or precision loss, so the language may need to check.

### Downcasting

For example, casting a superclass reference to a subclass reference:

```java
Object x = "hello";
String s = (String) x;
```

The compiler only knows the static type of `x` is `Object`; the actual object type must be confirmed at runtime.

### Subrange Checks

If the language supports range types, for example:

```text
1..100
```

Then assigning an ordinary integer to this type requires checking whether the value is indeed within the range.

## Type Inference

`Type inference` means the language automatically infers types from context; the programmer does not need to explicitly annotate all types.

It is commonly seen in:

* Variable initialization
* Function return values
* Generic function calls
* Lambdas / closures

For example:

```rust
let x = 3;
```

The compiler can infer that `x` is an integer type.

The goal of type inference is not to eliminate the type system, but to reduce redundant annotations. Types still exist; they are simply deduced by the compiler.

## Explicit and Implicit Parametric Polymorphism

`Explicit parametric polymorphism` requires the programmer to explicitly write type parameters.

For example:

```java
List<String>
```

The benefit is clarity and control; the type is easy to know when reading code.

`Implicit parametric polymorphism` automatically deduces type parameters through type inference. The programmer does not need to write `<T>`; the compiler infers from the usage of the expression.

The benefit is more concise code, closer to mathematical expression.

## Hindley-Milner Type Inference

The core process of Hindley-Milner type inference can be understood as three steps:

1. Create type variables for unknown types.
2. Collect type constraints based on the expression structure.
3. Use unification to solve these constraints, and generalize unconstrained type variables at appropriate positions.

For example:

```ml
fun x -> x
```

Here `x` is not used in any concrete operation, so the compiler has no reason to restrict it to `int`, `string`, or any other concrete type. It will be inferred as:

```text
'a -> 'a
```

Meaning: receives a value of some type, returns a value of the same type.

This is why ML's type inference can naturally derive polymorphism. Variables not constrained to a concrete type are generalized into generic types at positions like `let` bindings.

## Duck Typing

The intuition behind duck typing is:

> If it walks like a duck and quacks like a duck, then it can be treated as a duck.

It does not care about the declared type of the object, nor does it require explicitly inheriting an interface. It only cares whether the object actually supports the required operations at runtime.

For example, a function call:

```python
x.quack()
```

As long as `x` has a `quack` method, this call can proceed. What `x`'s class name is does not matter.

Duck typing mainly appears in dynamic languages, such as:

* Python
* Ruby
* JavaScript

Go and TypeScript also have similar "if the structure satisfies, you can use it" ideas, but they are better called structural typing or static duck typing, since checking can happen at compile time.

## Why Equality Testing Is Subtle

Equality seems like simply asking:

```text
Does a equal b?
```

But the real question is: what exactly do you want to compare?

| Dimension | Question | Example |
| ---- | ---- | ---- |
| Reference equality | Is it the same memory location? | Java `==` comparing object references |
| Structural equality | Are the contents the same? | Java `.equals()` |
| Semantic equality | Are they equivalent in mathematical sense? | `{1,2,3}` and `{3,2,1}` as sets are equal |
| Floating-point precision | Does computational error affect the result? | `0.1 + 0.2 != 0.3` |
| Implicit conversion | Does coercion occur before comparison? | In JS, `"0" == 0` is `true` |

So what makes equality testing subtle is: different languages, different types, different operators may be answering completely different questions.

One object can be, relative to another object:

* Same address
* Same content
* Semantically equivalent
* The same after conversion
* The same within some tolerance

All of these may be called "equal," but they are not the same kind of equality.

## Deep Comparison and Shallow Comparison

`Shallow comparison` only compares the first level.

For simple values like numbers, booleans, and strings, it typically compares the values directly. For objects or arrays, shallow comparison likely only compares references -- i.e., whether they point to the same memory address.

`Deep comparison` recursively compares internal content.

For example, two objects:

```js
{ name: "Aki", tags: ["PL", "compiler"] }
```

If their addresses differ but every level of fields and values is the same, deep comparison considers them equal.

## Deep Assignment and Shallow Assignment

`Shallow assignment` typically just copies the reference. Two variables point to the same object.

The result: modifying the object through one variable is visible to the other.

`Deep assignment` recursively copies the entire object structure. After copying, the new object and the original exist independently in memory.

So:

* shallow copy: fast, memory-efficient, but prone to shared state
* deep copy: safer, but costlier

Just like equality, on the surface it's just "copy," but the real question is: are we copying the reference, or the entire object graph?

## Summary

The Types chapter can be threaded together with several questions:

1. What type does a value belong to?
2. What operations does this type allow?
3. Are type errors discovered at compile time or runtime?
4. When are two types considered the same?
5. When can two types be used together?
6. Is a type conversion explicit, implicit, or just a change of interpretation?
7. How can a piece of code be safely reused across multiple types?
8. Is "equality" comparing address, structure, semantics, or the result after conversion?

The essence of a type system is boundary management in language design. It defines some operations as legal and others as errors; it can make programs safer, but can also make languages more complex. Understanding type systems is not just memorizing `int`, `float`, `string`, but understanding how languages use rules to organize values, operations, and abstractions.
