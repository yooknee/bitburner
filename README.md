# bitburner

Learning TypeScript and distributed scheduling by playing
[Bitburner](https://github.com/bitburner-official/bitburner-src), a game where the gameplay
*is* writing JavaScript to automate a simulated network of servers.

**This repo is a course, not a script collection.** Every script here exists to teach
something — a TypeScript concept, a distributed-systems idea, or a constraint the game
enforces that real infrastructure also enforces but hides. If a script gets replaced by a
better one, the old one stays in `notes/` as a record of why. Copy-pasted solutions from
elsewhere don't go in.

Coming from Python? Start with [`notes/typescript.md`](notes/typescript.md) — TypeScript's
type annotations behave almost exactly like Python's type hints, and most of the rest is
punctuation.

## Setup

```bash
npm install
npm run watch
```

Then in the game: **Options → Remote API**, port `12525`, **Connect**.

That connection is worth understanding, because it explains the file naming:

```
src/util/map.ts  ──tsc──▶  dist/util/map.js  ──filesync──▶  home/util/map.js
   you write this          types stripped out           what the game runs
```

You edit `.ts`; the compiler deletes every type annotation and writes plain `.js`; the sync
daemon pushes that into the game. In the game terminal you always type the `.js` name. The
game also pushes `NetscriptDefinitions.d.ts` back to you — the full API, typed, straight
from your installed version. That file is the authoritative reference, more so than any
documentation online.

## The scripts, and what each one is for

| Script | Run it to | Read it to learn |
| --- | --- | --- |
| `util/map.js` | See the whole network: root status, ports needed, hacking level required, money, RAM | TypeScript basics — type annotations, inference, `.map()`/`.sort()` chains, objects vs. dicts |
| `early/deploy.js` | Root everything reachable and put it all to work | Fan-out over a heterogeneous fleet; why `scp` + `exec` beats config management here |
| `early/grind.js` | Actually make money | Why workers must stay stupid — RAM is charged *per thread*, so every function you add costs you fleet capacity |

Typical loop: `run util/map.js` to see what you're looking at, then `run early/deploy.js`.
Re-run `deploy` whenever your hacking level jumps or you buy a new `.exe`.

## The two constraints that shape everything

**RAM is charged per thread.** A script's cost is fixed by which NS functions appear in it —
whether or not they run — and you pay that cost once per thread. `grind.ts` calls seven NS
functions and lands around 2.4GB; a worker that only calls `ns.weaken()` costs about 1.75GB.
Same servers, ~37% more threads. This is why intelligence lives on `home` and workers stay
dumb, and it's the inverse of normal infrastructure, where the control node is beefy and the
agents are trivial. Check real costs with `ns.getScriptRam(script, "home")`.

**Imports must be absolute from `src/`, no leading slash, no extension** — otherwise the game
and TypeScript disagree about what a path means:

```ts
import { walk } from "lib/net";   // src/lib/net.ts
import { NS } from "@ns";         // the game's type definitions
```

And a script deployed to a *remote* server needs its imports copied there too, which is why
`early/grind.ts` imports nothing at all — `deploy.ts` only has to `scp` one file.

## Where this goes

See [`notes/progression.md`](notes/progression.md). Short version: proportional hacking (done)
→ buy RAM instead of Hacknet nodes → HWGW batching, which is the real problem and a genuine
scheduling exercise.

Standing rule: finished Bitburner automation is downloadable, and downloading it deletes the
game. Build it, badly, then fix it.

## Reference

- [NS API docs](https://github.com/bitburner-official/bitburner-src/blob/dev/markdown/bitburner.md) — every function with its RAM cost
- [Remote API docs](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/en/programming/remote_api.md)
- In-game: `Documentation` in the sidebar, `help` in the terminal
