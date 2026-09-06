# Bitburner scripts — orientation for Claude

Joni's Bitburner repo. TypeScript in `src/`, compiled to `dist/` and pushed into the running
game by `npm run watch` over the Remote File API. See `README.md` for setup.

**This repo is a learning vehicle.** Joni is using Bitburner to learn TypeScript and to think
about distributed scheduling; the game is the excuse. That changes what "done" means here:
working code that he doesn't understand is a failed answer, not a fast one.

## Teaching posture

Default to explaining, not delivering. Concretely:

- **Say what a thing does before writing it.** A short description of the approach, then the
  code — not code followed by a summary. If the design has a real trade-off, name the
  alternative you rejected and why.
- **Joni comes from Python** and reads JavaScript "a bit". Reach for Python analogies when
  they're honest: type annotations behave like Python's hints (checked ahead of time, erased
  at runtime), `.map()` is a comprehension, `for...of` is `for...in`. Say so where they
  *diverge* too — `.sort()` takes a two-argument comparator rather than a `key=`, objects
  aren't dicts, `const` has no Python equivalent. `notes/typescript.md` is the running
  reference; add to it when a new concept comes up rather than re-explaining it in chat.
- **Annotate new code with the non-obvious why.** Not what the line does — why it's shaped
  that way. RAM costs, why a function lives in `lib/` versus inline, why a worker imports
  nothing.
- **Leave the next problem visible.** When you finish a piece, say what it doesn't do yet.
- **Ask before writing something large.** If a request would produce more code than Joni can
  reasonably read in one sitting, propose the shape first.

**Don't hand over a finished game.** Fully automated Bitburner solutions are downloadable and
using one deletes the point. Write the piece asked for; don't jump three progression steps
ahead. In particular the batcher (`notes/progression.md`) is the thing Joni is building
toward — help him build it, don't produce it.

**Check the game, not your memory.** Bitburner changes across versions and there's a lot of
stale advice about it in the world and in your weights. Verify specific numbers — RAM costs,
augmentation prices, faction requirements, formula constants — against
`NetscriptDefinitions.d.ts` in this repo (downloaded from Joni's actual running game, so it's
authoritative for his version) or the
[NS docs](https://github.com/bitburner-official/bitburner-src/blob/dev/markdown/bitburner.md).
Say when you're unsure rather than inventing a plausible number. A worked example: the game's
number formatters moved from `ns.formatNumber()` to `ns.format.number()`, so `lib/fmt.ts`
hand-rolls its own rather than guessing which exists.

## Constraints that shape every script here

- **RAM is the binding constraint, always.** Every NS function has a RAM cost, charged
  statically per script whether or not the call executes — and charged again per thread.
  `home` starts at 8GB; the first hackable servers have 4–16GB. `ns.getServer()` is 2GB where
  the individual getters (`getServerMaxMoney`, `getServerMinSecurityLevel`, …) are 0.1GB each.
  `ns.exec` is 1.3GB and `ns.scp` 0.6GB, so those stay out of workers entirely.
- **Threads are the unit of work.** One `hack` thread steals a fixed fraction; the same script
  at 500 threads is 500× the effect for 500× the RAM. Script design is mostly "how do I turn
  free RAM into threads against the right target".
- **Intelligence on `home`, stupidity everywhere else.** A worker's RAM cost is multiplied by
  every thread you run, so a function added to a worker costs fleet capacity. Controllers run
  once on `home` and pay their cost once.
- **Imports are absolute from `src/`, no leading slash, no extension.** A script deployed to a
  remote server needs its imports `scp`'d alongside it — which is why `early/grind.ts`
  deliberately imports nothing.

## Layout

- `src/early/` — bootstrap scripts for a fresh game or a fresh BitNode
- `src/lib/` — shared helpers, imported by scripts that only ever run on `home`
- `src/util/` — one-shot informational commands
- `notes/` — the actual point of the repo: `typescript.md` (Python → TS reference),
  `progression.md` (what to build next and why)

## Verifying a change

There's no test harness — the game is the test. Before saying a script works:

1. `npx tsc --noEmit` must be clean.
2. State the script's RAM cost and where it will fit. `ns.getScriptRam` in-game is the real
   answer; summing documented per-function costs is an estimate, so label it as one.
3. Say plainly what Joni should run and what he should expect to see. If you haven't watched
   it run — and you usually haven't, since you have no game — say so. Never report a script as
   working on the strength of it compiling.
