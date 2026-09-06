---
created: 2026-09-06
---

# TypeScript for a Python person

Written against the actual code in this repo. Add to it whenever a new concept shows up
rather than re-explaining it in chat.

## The one-line version

TypeScript is JavaScript plus type annotations, and the compiler's main job is to **delete
the annotations**. `tsc` is to TypeScript what `mypy` is to Python: a checker that runs before
your code does and has no presence at runtime.

The difference is that Python keeps hints around in `__annotations__` — TS types are gone
completely. The game never sees a single one.

```ts
export async function main(ns: NS): Promise<void> {
```
```python
def main(ns: NS) -> None:
```

`name: Type` for parameters, `: Type` after the parens for the return. `void` is `None`.
`Promise<void>` means "async, eventually gives you nothing" — the angle brackets are a
generic, same idea as `list[str]`.

## Direct translations

| TypeScript | Python |
| --- | --- |
| `` `level ${n}` `` | `f"level {n}"` |
| `for (const x of xs)` | `for x in xs` |
| `xs.map(f)` | `[f(x) for x in xs]` |
| `xs.filter(p)` | `[x for x in xs if p(x)]` |
| `(a) => a * 2` | `lambda a: a * 2` |
| `a ? b : c` | `b if a else c` |
| `s.padEnd(5)` / `s.padStart(5)` | `s.ljust(5)` / `s.rjust(5)` |
| `new Set<string>()` | `set()` |
| `[...seen]` | `list(seen)` |
| `const [a, b] = pair` | `a, b = pair` |
| `x ?? y` | `x if x is not None else y` |
| `interface Node { host: string }` | `class Node(Protocol): host: str` |

Arrow functions aren't limited to one expression the way `lambda` is — `(x) => { ... }` with
a body and `return` is normal and common.

## Things with no clean Python equivalent

**`const` / `let`.** `const` means the *name* can't be rebound; `let` means it can. `const`
does **not** freeze contents — a `const` array can still be pushed to. Use `const` by default.
Closest Python analogue is `typing.Final`, which nobody uses.

**Two kinds of nothing.** `null` (deliberately empty) and `undefined` (never set). Python has
one `None`. `??` and `?.` treat both as "nothing", so `a ?? b` is the safe default-value
operator and `a?.b` is the safe attribute access.

**Structural typing.** TS types match on *shape*, not on declared inheritance. Anything with
the right fields satisfies an `interface`. Python's `Protocol` is the same idea; TS just does
it everywhere by default.

**Type inference that propagates.** In `map.ts` only `ns: NS` and the return type are written
by hand. TS worked out that `rows` is an array of objects with seven specific fields, so
`r.money` autocompletes and `r.monies` is a compile error. You annotate the boundaries and the
compiler fills in the middle.

## Gotchas that will actually bite

**`.sort()` is not `sorted()`.** It mutates in place, and with no argument it sorts
**lexicographically** — `[10, 9, 1].sort()` gives `[1, 10, 9]`. Always pass a comparator: a
function of *two* items returning a number, negative meaning "a first".

```ts
.sort((a, b) => b.money - a.money)   // descending
.sort((a, b) => a.money - b.money)   // ascending
```

Subtract in the wrong order and you silently get the wrong end of the list.

**`/` is always float division.** No `//`. `deploy.ts` has `Math.floor(available / cost)` for
exactly this reason — threads have to be a whole number.

**Empty collections are truthy.** `if ([])` and `if ({})` both run the body. In Python they
don't. Check `.length` explicitly.

**Use `===`, never `==`.** `==` does type coercion and produces things like `0 == ""` being
true. `===` is the sane one.

**Object literals need parens after `=>`.** `(host) => ({ host })` — without the wrapping
parens, `{` is read as a function body. This one catches everyone.

**Shorthand keys.** `{ host, root: true }` means `{ host: host, root: true }`. Handy, but it
reads like a set the first few times you see it.

## Patterns from `lib/net.ts` worth a second look

```ts
const all: [string, (host: string) => void][] = [
  ["BruteSSH.exe", (h) => ns.brutessh(h)],
  ...
];
return all.filter(([program]) => ns.fileExists(program, "home")).map(([, run]) => run);
```

The type reads inside-out: `[string, (host: string) => void]` is a **tuple** of a string and a
function-taking-a-string-returning-nothing; the trailing `[]` makes it an array of those.
Python would write `list[tuple[str, Callable[[str], None]]]`.

`([program]) => ...` destructures the tuple in the parameter list and takes the first element.
`([, run]) => run` skips the first and takes the second — the leading comma is doing real work.

```ts
const host = queue.pop() as string;
```

`as` is an **assertion**, not a conversion: "trust me, this is a string." `pop()` can return
`undefined`, and the `while (queue.length > 0)` guard means it won't here. TS can't see that,
so `as` shuts it up. Treat every `as` as a small IOU — it's the one place TS stops protecting
you, and Python's `cast()` has the same smell.

## Worth learning next

- **Union types and narrowing** — `string | undefined`, and how an `if` check teaches the
  compiler which one you have. This is where TS gets genuinely better than Python hints.
- **`interface` vs `type`** — mostly interchangeable; `interface` for object shapes by
  convention.
- **`async`/`await`** — same keywords as Python, same meaning, but every `ns.hack()` and
  friends returns a Promise, so `await` is everywhere in worker code.
