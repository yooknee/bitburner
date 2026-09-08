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

### What a working connection looks like

`npm run watch` starts three processes at once — `tsc -w` compiling `src/` into `dist/`, a
local file watcher, and `bitburner-filesync` holding the WebSocket. Healthy output:

```
[watch:remote]    Server is ready, running on 12525!
[watch:transpile] Found 0 errors. Watching for file changes.
[watch:remote]    lib/net.js changed
[watch:remote]    early/deploy.js changed
[watch:remote]    util/map.js changed
```

Leave it running while you play. Save a file, it's in the game a second later.

The connection is **outbound from the game to you** — the game dials `localhost:12525`, so
both have to be on the same machine and the game does the connecting. Nothing external can
set this up for you.

When it doesn't work:

| Symptom | Cause |
| --- | --- |
| `Cannot find module '@ns'` before you've ever connected | Expected. `NetscriptDefinitions.d.ts` comes *from* the game — connect once and it appears. |
| Remote API indicator stays red | The watcher isn't running, or something else holds 12525. Change `port` in `filesync.json` and use the same number in-game. |
| `EADDRINUSE` on startup | A previous `npm run watch` is still alive. Kill it. |
| Connects, but no files show up in game | Check `dist/` actually has `.js` files — if `tsc` is reporting errors, nothing gets compiled to push. |
| Files arrive but the game says the script doesn't exist | You typed the `.ts` name. It's `run util/map.js` in the terminal, always. |
| Steam version won't connect | Same steps; the Steam build supports RFA too. For devtools, add `--remote-debugging-port=9222` to its launch options. |

## The scripts, and what each one is for

| Script | Run it to | Read it to learn |
| --- | --- | --- |
| `util/map.js` | See the network: root status, ports, level required, money, RAM | TypeScript basics — annotations, inference, `.map()`/`.sort()` chains |
| `util/root.js` | Root everything reachable; writes `rooted.txt` with connect chains | Breadth-first search, and why iterating a depth-limited scan finds nothing new |
| `util/backdoor.js` | List what you can backdoor now, as paste-ready terminal chains | Path reconstruction from parent links |
| `util/rank.js` | See what's actually worth hacking, by money/sec/thread | Why max money is a bad proxy, and what the Formulas API is for |
| `util/plan.js` | See one batch's thread counts, RAM and yield against a target | The arithmetic behind batching |
| `hwgw/batch.js` | Batch one target | Scheduling under a hard resource constraint |
| `hwgw/all.js` | Batch as many targets as the fleet can usefully feed | Saturation — why more RAM stops helping past a point |

```
run util/root.js            # root everything
run util/rank.js            # see what's worth hitting
run hwgw/all.js 0.10        # put the whole fleet to work
```

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
