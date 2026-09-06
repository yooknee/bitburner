# bitburner

Scripts for [Bitburner](https://github.com/bitburner-official/bitburner-src), written in
TypeScript on disk and synced into the game over the Remote File API. Based on the
[official TypeScript template](https://github.com/bitburner-official/typescript-template).

Writing scripts in the in-game editor works, but you get no version history, no real
autocomplete, and no way to point another tool at them. This setup fixes all three.

## Setup

```bash
npm install
npm run watch
```

Then in the game: **Options → Remote API**, port `12525`, **Connect**. The indicator turns
green, `NetscriptDefinitions.d.ts` lands in this folder (that's the full NS API, typed —
it's what makes autocomplete work), and everything under `src/` appears on your `home`
server as compiled `.js`.

Leave `npm run watch` running while you play. Save a file, it's in the game.

Works with both the Steam and web builds.

## What's here

| Script | What it does |
| --- | --- |
| `util/map.js` | Prints the whole network: root status, ports needed, hacking level required, max money, RAM. Start here when you don't know what to hack. |
| `early/deploy.js` | Roots everything it can reach, then fills every rooted server with `grind.js` aimed at the best target you currently qualify for. |
| `early/grind.js` | The worker: weaken → grow → hack, forever, against one target. Dependency-free so it can be copied onto a 4GB server on its own. |

Typical loop:

```
run util/map.js          # see the network
run early/deploy.js      # root everything, put the whole network to work
```

Re-run `deploy.js` whenever your hacking level jumps or you buy a new `.exe` — it kills the
old workers and re-places them against a better target.

## Imports

Import paths must be absolute from `src/`, with **no leading slash and no file extension**,
or the game and TypeScript will disagree about what they mean:

```ts
import { walk } from "lib/net";   // src/lib/net.ts
import { NS } from "@ns";         // the game's type definitions
```

One gotcha: a script that runs on a *remote* server needs its imports copied there too.
That's why `grind.ts` imports nothing — `deploy.ts` only has to `scp` one file.

## Where this goes next

`grind.js` is a proportional loop: every thread independently decides whether to weaken,
grow, or hack. It's simple and it works, but it wastes most of its time — threads hack a
server that's already drained, or grow one that's already full.

The real answer is **HWGW batching**: fire hack/weaken/grow/weaken in timed waves so each
lands exactly when the previous one finishes, keeping the target permanently at max money
and min security. That's the interesting problem in this game, and it's a genuine
scheduling exercise. See `notes/progression.md`.

## Reference

- [NS API docs](https://github.com/bitburner-official/bitburner-src/blob/dev/markdown/bitburner.md) — the full function list with RAM costs
- [Remote API docs](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/en/programming/remote_api.md)
- In-game: `Documentation` in the sidebar, and `help` in the terminal
