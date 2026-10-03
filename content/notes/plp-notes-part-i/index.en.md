---
hidden: true
title: "PLP 1: Type Systems and Composite Types"
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


The core question of the composite types chapter is: how do languages organize multiple values into more complex data structures, and how are those structures actually represented in memory.

If the Types chapter focuses on "what a value is," the Composite Types chapter focuses on "how multiple values are placed together." This is not just a syntax design issue; it also directly affects memory layout, access efficiency, safety, assignment semantics, comparison semantics, and garbage collection.

Think of this chapter as a set of connections between the language layer and the machine layer:

* record / struct: how multiple fields are arranged
* union / variant record: how the same block of memory represents different forms of data
* array / slice: how contiguous data is addressed and sliced
* pointer / reference: how objects connect to each other
* garbage collection: how programs handle heap objects that are no longer reachable

## Records and Holes

A record, called a struct in many languages, combines multiple fields into a whole.

For example, a struct in C:

```c
struct MyRecord {
    char a;
    int b;
};
```

Intuitively, `char` is 1 byte, `int` is 4 bytes, so the entire struct should be 5 bytes. But in practice, it usually isn't. The compiler may insert a few empty bytes between `char a` and `int b` so that the address of `int b` satisfies alignment requirements.

These bytes that store no actual data and only serve as placeholders are called holes or padding.

### How Holes Arise

Holes mainly come from data alignment.

Modern CPUs prefer to access memory along certain boundaries when reading data. For example, a 4-byte `int` placed on a 4-byte-aligned address is faster to read and better meets hardware requirements. If fields are tightly packed, causing a field to straddle an inappropriate boundary, the CPU may need more reads, or on some architectures may not be able to access it directly at all.

So the compiler inserts padding to align field addresses.

For example:

```c
struct MyRecord {
    char a;   // 1 byte
              // 3 bytes padding
    int b;    // 4 bytes
};
```

At this point, the entire struct may occupy 8 bytes, not 5.

### The Impact of Holes

Holes have several important effects:

* Increase memory footprint.
* Affect binary layout, complicating cross-language, network protocol, and file format mapping.
* Affect equality comparison, because padding bytes may contain residual random data.
* May introduce security issues, because holes may contain remnants of old memory content.

This is also why record assignment is usually easier to implement than record comparison.

During assignment, the compiler can directly copy the entire block of memory, including padding. Even if the contents of the padding have no semantic meaning, copying them is fine.

But during comparison, if the entire block of memory is compared directly, padding bytes may differ, causing two semantically identical records to be judged as different. Therefore, comparing records usually requires field-by-field comparison, not a simple memcmp.

## Packing

`Packing` means eliminating or reducing holes in records, making fields as tightly packed as possible.

Its advantages:

* Reduces memory footprint.
* Suitable for scenarios requiring precise layout, such as mapping hardware registers, network protocols, and file formats.
* Can guarantee that different devices or different programs see the same memory view.

Its disadvantages:

* Access may become slower.
* Unaligned access may cause errors on some hardware.
* Code becomes harder to port.
* Compiler optimization space shrinks.

So packing is generally not used in ordinary business code, but more in embedded, systems programming, network protocols, binary file parsing, and similar scenarios.

## Why Compilers May Reorder Fields

If the language allows it, the compiler may reorder the field order of records to reduce padding.

For example, the original field order:

```c
char a;
int b;
char c;
```

May produce multiple holes. If changed to:

```c
int b;
char a;
char c;
```

The overall memory footprint may be smaller.

But this also introduces problems:

* Programmers cannot rely on the physical order of fields.
* Errors arise when interacting with C ABIs, hardware layouts, network protocols, and file formats.
* Reflection, serialization, and debugging tools may become more complex.

Therefore, many languages restrict the compiler from arbitrarily reordering fields, especially when record layout must be exposed externally.

## Unions and Variant Records

A union is a special kind of composite type. It allows multiple fields to share the same block of memory. The size of a union is usually determined by its largest member.

For example:

```c
union Value {
    int i;
    float f;
    char* s;
};
```

The same block of memory can be interpreted as `int`, `float`, or `char*`. This is very space-efficient, but also dangerous, because the programmer must remember which type is currently stored.

### Variant Records

A variant record can be thought of as a safer union. It usually carries a tag that records which variant is currently active.

Many sum types / algebraic data types in modern languages are essentially related to tagged unions.

For example, in Rust:

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}
```

Here `Result` could be `Ok` or `Err`. The language records the current variant and forces the programmer to handle different cases.

### Modern Uses

Union / variant records have two main uses in modern programs:

First, representing type-safe states or results.

For example, an operation can either succeed or fail:

```rust
Result<T, E>
```

This is clearer than returning `null` or error codes, because success and failure are encoded in the type system.

Second, representing data structures with multiple forms.

For example, in an AST, an expression could be:

* literal
* variable
* binary expression
* function call
* if expression

These different forms can be represented with variant types.

## Width Subtyping and Depth Subtyping

Record subtyping has two important concepts: width subtyping and depth subtyping.

### Width Subtyping

Width subtyping means that if a record has all the fields required by another record, and has additional fields on top, it can be viewed as a subtype of the latter.

For example:

```ts
type Person = {
    name: string
}

type Student = {
    name: string
    age: number
}
```

`Student` has the `name` field that `Person` requires, plus `age`. In a system supporting width subtyping, `Student` can appear where `Person` is needed.

The intuition is: all required fields are present; extra fields can be ignored.

### Depth Subtyping

Depth subtyping focuses on the subtype relationships of the field types themselves.

For example:

```ts
type A = {
    info: Person
}

type B = {
    info: Student
}
```

If `Student` is a subtype of `Person`, then `B` may be viewed as a subtype of `A`.

But depth subtyping introduces risks in mutable records.

If a function believes it has:

```ts
{ info: Person }
```

and it can modify the `info` field, it might write an ordinary `Person` into it. But the original object actually requires `info` to be `Student`. This breaks type safety.

So mutable fields make depth subtyping more complex.

## Why Record Subtyping and Union Subtyping Have Opposite Directions

In record subtyping, the record with more fields is the subtype.

Because it can satisfy the requirements of the record with fewer fields.

```text
{name, age} <: {name}
```

But in union subtyping, the union with fewer constructors is the subtype.

For example:

```text
Red | Blue <: Red | Blue | Green
```

The reason is that a union represents "what cases are possible." Fewer possibilities means the type is more specific, and more easily accepted by a wider union.

Simply put:

* record is "what I have"
* union is "what I might be"

More record fields means more capability. Fewer union branches means narrower possibilities.

## Array Slice

An array slice is a reference to a contiguous subsequence within an array. It usually does not copy the original data, but provides a view.

A slice typically contains:

* A pointer or reference to the starting position
* length
* Some languages also include capacity, such as Go

For example, a Go slice has:

```text
pointer + length + capacity
```

But not all languages' slices expose capacity. More generally, the core of a slice is pointer/reference + length.

### Uses of Slices

Slices are very useful because they let programs work with only a portion of a large array without copying the entire data.

Common uses include:

* Processing a small segment of a huge array.
* Using the same function for both the full array and partial segments.
* String parsing.
* Sliding windows.
* Avoiding unnecessary data copying.
* Using length information for bounds checking, improving safety.

But slices have an important semantic: they usually share the data of the original array. Modifying elements in a slice may also modify the original array.

## Two-Dimensional Array and Array of Arrays

Two-dimensional arrays and arrays of one-dimensional arrays can have significant differences in semantics and memory layout.

### True Two-Dimensional Array

A true two-dimensional array is usually one large contiguous block of memory.

For example, a `3 × 4` array can store all elements contiguously.

Pros:

* Compact memory.
* Simple addressing.
* Good cache locality.
* Suitable for numerical computation.

Cons:

* Usually requires a rectangular structure.
* Each row has a fixed length.

### Array of One-Dimensional Arrays

An array of arrays is an array where each element points to another array.

Its advantages:

* Each row can have a different length.
* More flexible.
* Rows can be independently allocated, replaced, or extended.

Disadvantages:

* Requires additional storage for row pointers.
* Addressing requires one extra level of indirection.
* Memory may be scattered, with poorer cache locality.
* Allocation and reclamation are more complex.

Simply put, contiguous two-dimensional arrays are better for performance; arrays of arrays are better for flexibility.

## Array Shape

Array shape refers to the size of each dimension of an array.

For example:

```text
int A[3][4][5]
```

The shape of this array is:

```text
3 × 4 × 5
```

Shape determines the total number of elements in the array, and also determines how multi-dimensional subscripts map to linear memory addresses.

## Stack Allocation and Heap Allocation

When can arrays declared in subroutines be placed on the stack, and when must they be placed on the heap?

### When It Can Go on the Stack

Typically, arrays can go on the stack when these conditions are met:

* Size is known at compile time, or fixed after function entry.
* Lifetime is only within the current function call.
* Size is moderate and won't cause stack overflow.
* The language and implementation permit this allocation method.

For example, a local fixed-size array in C:

```c
int a[100];
```

It can usually be placed on the stack.

Some languages support VLA (variable-length array). Its size is determined at runtime, but once it enters scope it no longer changes; it may also be allocated on the stack. But this depends on the language and implementation.

### When It Must Go on the Heap

Situations typically requiring heap allocation include:

* The object needs to survive across function calls.
* The size is unknown at compile time and unsuitable for the stack.
* The array is very large.
* The array needs dynamic resizing.
* The data structure's lifetime does not obey a strict function call stack.

For example:

```c
int* a = malloc(n * sizeof(int));
```

This is heap allocation.

## Contiguous Layout and Row-Pointer Layout

Multi-dimensional arrays have two common layouts: contiguous layout and row-pointer layout.

### Contiguous Layout

Contiguous layout places all elements in a single continuous block of memory.

Pros:

* Simple address calculation.
* Good cache locality.
* Suitable for sequential access.
* Low memory overhead.
* Friendly to numerical computation.

Cons:

* Shape is usually more fixed.
* Inconvenient to expand or change a single row.
* Requires a single large contiguous block of memory.

### Row-Pointer Layout

Row-pointer layout stores a set of pointers first, each pointing to a row.

Pros:

* More flexible.
* Each row can have a different length.
* Individual rows can be replaced.
* Dynamic allocation is more natural.

Cons:

* One extra pointer indirection per access.
* Memory is more scattered.
* Poorer cache locality.
* Requires extra storage for pointers.

## Row-Major and Column-Major

Contiguous multi-dimensional arrays must also decide in what order elements are placed into memory.

### Row-Major

Row-major fills the first row completely, then the second row.

For example:

```text
A[0][0], A[0][1], A[0][2], A[1][0], A[1][1], ...
```

Languages like C, C++, and Java typically use row-major or similar layouts.

### Column-Major

Column-major fills the first column completely, then the second column.

For example:

```text
A[0][0], A[1][0], A[2][0], A[0][1], A[1][1], ...
```

Fortran, MATLAB, and similar tend toward column-major.

### Why Programmers Need to Know the Layout

Because access order affects cache performance.

Modern CPUs read memory one cache line at a time. If the program accesses in memory-contiguous order, it can fully utilize the cache. If the access order is opposite to the layout, it will hop around frequently, and performance can degrade noticeably.

For row-major arrays, the more efficient access pattern is usually:

```c
for (int i = 0; i < rows; i++) {
    for (int j = 0; j < cols; j++) {
        use(A[i][j]);
    }
}
```

The inner loop walks along the row, so access is contiguous.

## Computing Array Element Addresses

When the compiler computes array element addresses, some work can be done at compile time, and some must be done at runtime.

### What Can Be Done at Compile Time

Typically includes:

* Element size, e.g., the size of `int`, `double`.
* The fixed size of each dimension.
* Subscript lower bound, if the language fixes it from 0.
* Offsets for constant subscripts.
* Fixed offsets of local arrays relative to the stack frame.

For example:

```c
A[5]
```

If `A` is a fixed array and the element size is known, then `5 * element_size` can be handled at compile time.

### What Must Be Done at Runtime

Typically includes:

* Variable subscripts, e.g., `i` in `A[i]`.
* The actual base address of heap objects.
* The actual address of the stack frame on each function call.
* The length of dynamic arrays.
* Bounds checking, e.g., checking `0 <= i < length`.

In languages emphasizing safety like Java and Rust, array access usually requires runtime bounds checking. The compiler can sometimes optimize away these checks, but semantically it must guarantee that out-of-bounds access does not silently occur.

## Why Strings Are Often More Special Than Arrays of Characters

Many languages give strings more operations than ordinary character arrays, because strings typically represent text, not just a sequence of characters.

Strings may support:

* Concatenation
* Substrings
* Pattern matching
* Encoding handling
* Immutability
* Hash caching
* Regex-related operations
* Unicode semantics

Whereas an array of characters is closer to a bare data container. It concerns itself with element storage and indexing, not necessarily text semantics.

So the difference between string and char array is not just a slightly richer API, but a different level of abstraction. String is a text abstraction; char array is the storage structure for a sequence of characters.

## Recursive Types

A recursive type is one whose definition contains itself.

The most classic example is a linked list:

```c
struct Node {
    int value;
    struct Node* next;
};
```

Here `next` points to another `Node`. Through this recursive structure, linked lists of arbitrary length can be constructed.

Recursive types allow languages to express:

* linked list
* tree
* graph
* AST
* nested data structures

But they also introduce a problem: a type cannot directly and infinitely contain itself.

For example, the following does not work:

```c
struct Node {
    int value;
    struct Node next;
};
```

Because this would require a `Node` to directly contain another complete `Node`, and that `Node` to contain yet another complete `Node`, with infinitely recursive size.

So recursive structures typically require pointers or references as an indirection layer.

## Reference Model and Pointer Model

In languages with a variable reference model, variables typically hold object references, not the objects themselves. Java, Python, JavaScript, Ruby, and similar languages are close to this model.

For example, in Java:

```java
Node next;
```

This field itself is a reference. The programmer does not need to explicitly write `*`.

In languages with a value model + pointers, the programmer needs to clearly distinguish values from addresses. Languages like C, C++, Rust, and Go all require programmers to face this distinction to some degree.

A comparison:

| Dimension | Reference Model | Value + Pointers Model |
| ---- | ---- | ---- |
| Recursive definitions | Implicit, automatic | Explicit, requires declaring pointer/reference |
| Memory cost | Usually higher, each object independently allocated | More controllable, layout can be finely arranged |
| Usability | Higher, intuitive | Lower, must manage addresses and lifetimes |
| Runtime efficiency | Affected by GC and memory fragmentation | More room for locality optimization |
| Representative languages | Java, Python, JavaScript, Ruby, Lisp | C, C++, Rust, Go, Pascal, Fortran |

The advantage of the reference model is that it's simpler to write, especially suitable for complex object graphs. The advantage of the pointer model is strong control, suitable for systems programming and performance-sensitive scenarios.

## Dereference

Dereference means finding the object that a pointer or reference points to.

In C/C++, dereference is explicit:

```c
int value = *ptr;
```

In Rust, you can also explicitly dereference:

```rust
let value = *ptr;
```

In Go:

```go
value := *ptr
```

In languages like Java, Python, JavaScript, and C#, dereference is typically transparent. When the programmer operates on an object, they don't need to explicitly write `*`. The language and runtime automatically find the object through the reference.

This design is easier to use but hides the costs of object indirection, shared state, and heap allocation.

## Pointer, Address, and Reference

`Address` is the numerical identifier of a memory location. It can be stored in registers or memory, and can also appear as part of a pointer value.

`Pointer` is a value with type semantics that denotes an address. It not only indicates an address, but also tells the language how to interpret the data at that address. Pointers can be dereferenced and may also support pointer arithmetic.

`Reference` is usually more like a restricted pointer. It is generally safer and semantically represents an alias for an object or variable.

A rough comparison:

| Concept | Meaning |
| ---- | ---- |
| Address | Numerical identifier of a memory location |
| Pointer | A value that can point to an address, be dereferenced, and possibly do arithmetic |
| Reference | A more restricted, safer alias or object reference |

In C++, a reference must typically be initialized and cannot be rebound. It also does not directly do arithmetic like an ordinary pointer.
In languages like Java/Python, references are closer to object handles; the programmer cannot directly see raw addresses.

## Interoperability of Pointers and Arrays in C

In C, arrays and pointers have strong interoperability.

For example:

```c
a[i]
```

Can often be understood as:

```c
*(a + i)
```

This brings some benefits:

* Concise expression.
* Array traversal can directly use pointer arithmetic.
* Suitable for low-level systems programming.
* Arrays passed to functions can naturally decay to pointers.

But it also brings many problems:

* Array length information is easily lost.
* Missing bounds checking.
* Easy out-of-bounds access.
* Pointer and array semantics are intermingled, hard for beginners to understand.
* High security vulnerability risk.

C's design here is very powerful, and very dangerous.

## Dangling References

A dangling reference points to an object or memory region that is no longer valid.

Common causes:

* After manually freeing heap memory, the pointer still points to the original address.
* After a function returns, a pointer still points to a local variable that has been destroyed.
* After an object's lifetime ends, a reference is still retained.

For example:

```c
int* p = malloc(sizeof(int));
free(p);
// p is now dangling
```

At this point, `p` still holds an address, but that memory no longer belongs to it.

The problems with dangling references are serious:

* Accessing it may cause program crashes.
* The original address may have been allocated to other data; modifying it corrupts unrelated objects.
* It can become a security vulnerability.
* Bugs are typically unstable and hard to reproduce.

Common prevention methods:

* In C/C++, set pointers to `NULL` after freeing.
* Use smart pointers to manage lifetimes.
* Use ownership/borrowing systems, e.g., Rust.
* Use GC to prevent the runtime from reclaiming still-reachable objects.

## Garbage

Garbage refers to objects on the heap that have been allocated but can no longer be accessed by the program.

For example:

```java
x = new Object();
x = new Object();
```

The object created in the first line, if no other reference points to it, becomes garbage after the second line.

It still occupies memory, but the program can no longer use it.

Problems with garbage include:

* Occupies memory.
* Causes memory leaks.
* Reduces allocator efficiency.
* In severe cases, causes the program to exhaust memory.

## Difference Between Dangling Reference and Garbage

These two problems are in opposite directions.

A dangling reference is:

```text
Reference still exists, but object is invalid
```

Garbage is:

```text
Object still exists, but no reference to it
```

Manual memory management languages are prone to both dangling references and garbage.
Languages with GC can typically avoid dangling references, because reachable objects won't be reclaimed, but memory leaks may still occur from accidentally retained references.

## Reference Counting

Reference counting is a garbage collection method. Each object records how many references currently point to it.

When the reference count reaches 0, the object can be freed immediately.

Pros:

* Objects can be reclaimed promptly.
* Relatively simple to implement.
* Does not require long global pauses.
* Reclamation timing is relatively predictable.

Cons:

* Every reference assignment must update the count, incurring runtime overhead.
* Each object needs extra storage for the counter.
* Cannot automatically handle cyclic references.

For example, two objects referencing each other:

```text
A -> B
B -> A
```

If the outside can no longer access A and B, they still keep each other's reference counts above 0. Thus they will not be reclaimed.

## Tracing Collection

Tracing collection starts from a set of roots and follows reference relationships to find all reachable objects. Objects not found are garbage.

Roots typically include:

* Local variables on the stack
* Registers
* Global variables
* References held by the runtime system

Pros of tracing collection:

* Can handle cyclic references.
* No need to update counts on every assignment.
* Can batch-reclaim garbage.
* Can combine with compaction to reduce memory fragmentation.

Cons:

* Reclamation is not necessarily immediate.
* Requires extra runtime mechanisms.
* Some implementations cause pause times.
* Typically requires more available heap space.

## Mark-and-Sweep

Mark-and-sweep has two phases:

1. Mark: starting from roots, mark all reachable objects.
2. Sweep: scan the heap and reclaim unmarked objects.

Pros:

* Can reclaim cyclic garbage.
* Does not need to move objects.
* Relatively straightforward to implement.

Cons:

* May produce memory fragmentation.
* Requires scanning the heap.
* Allocating large objects may fail due to fragmentation.

## Stop-and-Copy

Stop-and-copy divides the heap into two regions. The program allocates objects only in one region. During GC, all live objects are copied to the other region, then the original region is cleared.

Pros:

* After reclamation, memory is very compact.
* Allocation is fast, typically only needing to bump a pointer.
* Does not produce external fragmentation.

Cons:

* Requires reserving half the space.
* High copying cost when many objects are live.
* References must be updated after objects move.
* Usually requires pausing the program during GC.

## Generational Garbage Collection

Generational GC is based on an empirical observation:

Most objects die young; a few objects live long.

So the heap is divided into a young generation and an old generation.

In the young generation, object mortality is high, suitable for copying collection. Since most objects are dead, only a few live objects need to be copied.

In the old generation, objects have survived multiple GCs and are relatively stable; they are usually not moved frequently, and mark-and-sweep or mark-compact can be used.

Pros:

* Most of the time, only the young generation is collected.
* Fast reclamation speed.
* Aligns with real program object lifetime patterns.

Cons:

* Complex to implement.
* Must handle references from old to young.
* Requires write barriers and other extra mechanisms.

## Conservative Garbage Collection

Conservative GC means the runtime does not fully know whether a value is actually a pointer, so it conservatively treats values that "look like addresses" as pointers.

This is common in languages like C/C++ that lack complete runtime type information.

Pros:

* Can add some degree of automatic reclamation to languages that originally do not support GC.
* Does not require full program cooperation.

Cons:

* May mistakenly treat ordinary integers as pointers.
* Some garbage may not be reclaimed.
* Usually cannot freely move objects because it doesn't know where all references are.

The principle of conservative GC is: better to under-reclaim than to mistakenly reclaim objects that may still be accessed.

## Impact of Copying Collectors on Cache Performance

Copying collectors are usually beneficial for cache performance.

The reason is that they copy live objects into contiguous regions, making related objects tighter in memory. When the program later accesses these objects, cache hits are more likely.

Additionally, after copying collection, the free space is also very contiguous, and allocating new objects only requires bumping a pointer, which is very fast.

But if many objects are live, the copying cost increases. Object movement also leads to reference update costs.

## GC Time-Space Tradeoff

Garbage collection involves a clear time-space tradeoff.

### Heap Size vs. GC Frequency

If the heap is large:

* GC frequency is low.
* The program runs more smoothly most of the time.
* But occupies more memory.
* A single GC may be heavier.

If the heap is small:

* GC frequency is high.
* Memory footprint is low.
* But more CPU time is spent on reclamation.
* The program may stutter frequently.

### Fragmentation vs. Compaction

Mark-and-sweep does not move objects; reclamation speed is relatively direct, but fragmentation is likely.

Copying/compacting collectors move objects, making memory more compact, but require time to copy objects and update references.

So GC design is always balancing:

```text
low memory usage / low pause time / high throughput / low fragmentation / simple implementation
```

These goals are hard to achieve all at once.

## Techniques to Reduce GC Pause Time

Common methods include:

* Incremental GC: break a large reclamation into many small steps.
* Concurrent GC: let GC run as much as possible concurrently with the program.
* Generational GC: most of the time, only collect the young generation.
* Parallel GC: use multiple threads for reclamation.
* Region-based allocation: batch-free by region.
* Escape analysis: allocate some objects on the stack, reducing heap pressure.
* Tuning heap size: reduce GC frequency through a larger heap.

Different languages and runtimes adopt different combinations.

## Smart Pointers

A smart pointer is a pointer object that automatically manages resources. It behaves like a pointer but automatically releases resources at the end of its lifetime.

Common smart pointers in C++ include:

```cpp
std::unique_ptr<T>
std::shared_ptr<T>
std::weak_ptr<T>
```

`unique_ptr` represents exclusive ownership. An object can have only one owner.
`shared_ptr` represents shared ownership, managing lifetime through reference counting.
`weak_ptr` observes an object without increasing the reference count, commonly used to break cyclic references.

The role of smart pointers is to turn manual `delete` into safer lifetime management.

## Summary

The Composite Types chapter can be threaded together with several sets of questions:

1. When multiple fields are placed together, how is the memory layout determined?
2. Why do holes appear in records?
3. Why can packing save space but potentially lose performance?
4. How do unions allow multiple types to share the same block of memory?
5. How do variant records add a tag for type safety?
6. Is an array contiguously stored, or row-pointer stored?
7. Does a slice copy data, or reference a view?
8. What is the difference among pointers, addresses, and references?
9. Why do recursive types typically need pointers or references?
10. What problems are dangling references and garbage, respectively?
11. How does GC balance time, space, pause time, and fragmentation?

The key point of this chapter is seeing the memory reality behind language abstractions. Records, arrays, slices, pointers, and references appear to be syntactic concepts, but they all boil down to how objects are allocated, addressed, copied, compared, and reclaimed. The design of composite types is fundamentally about making tradeoffs among expressiveness, runtime efficiency, and memory safety.

