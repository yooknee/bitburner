---
created: 2026-09-06
---

# Progression notes

Working notes on what to build next and why. Edit freely — this is a scratchpad, not doctrine.

## Now: proportional hacking

`early/deploy.js` + `early/grind.js`. Every thread independently checks the target and
decides to weaken, grow, or hack. Simple, robust, and roughly 10–20% as efficient as it
could be, because threads constantly act on stale state — hacking a server that's already
drained, growing one that's already full.

Good enough to get to a few million and buy the first port openers. Don't over-invest in it.

## Next: buy RAM, not Hacknet

Two ways to spend early money:

- **Hacknet nodes** — visible, satisfying, and a trap in most BitNodes. They pay back slowly
  and the money doesn't compound into anything else.
- **`purchaseServer` + home RAM upgrades** — more RAM means more threads means more money
  means more RAM. This is the compounding loop.

Buy servers. `ns.purchaseServer` costs money per GB and you can own 25 of them; a script that
buys the biggest server you can afford and adds it to the worker pool is a good next build.

(Caveat: Hacknet is genuinely correct in BitNode 9, where the nodes become Hacknet *servers*
that also run scripts. Different game.)

## Then: HWGW batching

The real thing. Instead of each thread deciding for itself, you schedule timed waves:

```
hack    ──────────────┐
weaken  ───────────────┤   each finishes ~200ms after the last
grow    ─────────────────┤
weaken  ──────────────────┤
```

Because `weaken` takes 4× as long as `hack` and `grow` takes 3.2×, you start them in the
order W-G-W-H but they *land* in the order H-W-G-W. Get the offsets right and the target
sits permanently at max money and minimum security, and every hack steals the maximum.

What makes it hard:
- Thread counts have to be computed, not guessed — `Formulas.exe` (`ns.formulas.hacking.*`)
  turns this from trial-and-error into arithmetic. Worth buying as soon as affordable.
- Batches must not overlap in a way that lets security drift, or the whole schedule desyncs.
- Timing jitter is real. Most working implementations leave a gap between batches rather
  than packing them perfectly.

Build this incrementally: get one correct batch against one target first. Don't start from
someone else's finished scheduler.

## Open questions

- Which BitNode after BN1? (BN4 gives the Singularity API — full automation of the
  non-hacking parts of the game. BN5 gives Formulas + intelligence.)
- Worth writing a stock-market script? Needs `TIX API Access` + `4S Market Data`, both
  expensive, and it's a separate money engine from hacking.
