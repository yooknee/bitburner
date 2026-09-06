# Bitburner scripts — orientation for Claude

Joni's Bitburner scripts. TypeScript in `src/`, compiled to `dist/` and pushed into the
game by `npm run watch` over the Remote File API. See `README.md` for setup.

## Ground rules

**Don't hand over a finished game.** Joni is playing this, not shipping it. Fully automated
Bitburner solutions exist as downloadable repos and using one deletes the point. Explain
mechanisms, write the piece being asked for, leave the next problem visible. If a request
would skip several progression steps at once, say so before writing it.

**Check the game, not your memory.** Bitburner changes across versions, and there's a lot of
stale advice about it in the world and in your weights. Specific numbers — augmentation
costs, faction requirements, RAM costs, formula constants — get verified against
`NetscriptDefinitions.d.ts` in this repo (it's downloaded from Joni's actual running game,
so it's authoritative for his version) or against the
[NS docs](https://github.com/bitburner-official/bitburner-src/blob/dev/markdown/bitburner.md).
Say when you're unsure rather than inventing a plausible number.

## Constraints that shape every script here

- **RAM is the binding constraint, always.** Every NS function has a RAM cost, charged
  statically per script whether or not the call runs. `home` starts at 8GB; the first
  hackable servers have 4–16GB. A script that pulls in one expensive function it barely
  uses can stop fitting anywhere. `ns.getServer()` is 2GB — the individual getters
  (`getServerMaxMoney`, `getServerMinSecurityLevel`, …) are 0.1GB each and usually the
  better deal. `ns.exec` is 1.3GB, `ns.scp` 0.6GB, so keep those out of workers.
- **Threads are the unit of work.** One `hack` thread steals a fixed fraction; the same
  script at 500 threads is 500× the effect for 500× the RAM. Script design is mostly
  "how do I turn free RAM into threads against the right target".
- **Imports must be absolute from `src/`, no leading slash, no extension** — see README.
  A script deployed to a remote server needs its imports `scp`'d alongside it, which is why
  `early/grind.ts` deliberately imports nothing.

## Layout

- `src/early/` — bootstrap scripts for a fresh game or a fresh BitNode
- `src/lib/` — shared helpers, imported by scripts that only ever run on `home`
- `src/util/` — one-shot informational commands (`map.js` etc.)
- `notes/` — strategy notes and decisions, in Joni's words as much as yours

## Verifying a change

There's no test harness — the game is the test. Before saying a script works:

1. `npx tsc --noEmit` must be clean.
2. State the script's RAM cost and where it will fit. `ns.getScriptRam` in-game is the
   real answer; adding up the documented per-function costs is the estimate.
3. Say plainly what Joni should run and what he should expect to see. If you haven't seen
   it run, say that too — don't report a script as working on the strength of it compiling.
