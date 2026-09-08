/**
 * HWGW batcher.
 *
 * Fires hack/weaken/grow/weaken in timed waves so they LAND 200ms apart in that
 * order. The result: the target sits permanently at max money and minimum
 * security, and every hack steals from a full pot at the best possible odds.
 *
 * usage: run hwgw/batch.js <target> [stealFraction]
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const target = ns.args[0];
  if (!target) { ns.tprint("usage: run hwgw/batch.js <target> [stealFraction]"); return; }

  const STEAL        = Number(ns.args[1] ?? 0.10);  // fraction of max money per batch
  const GAP          = 200;                          // ms between landings inside a batch
  const SPACING      = 4 * GAP;                      // ms between batch launches
  const HOME_RESERVE = 32;                           // GB left free on home for you

  const W = "hwgw/w.js", G = "hwgw/g.js", H = "hwgw/h.js";
  const COST = { [W]: ns.getScriptRam(W, "home"), [G]: ns.getScriptRam(G, "home"), [H]: ns.getScriptRam(H, "home") };
  if (Object.values(COST).some((c) => c === 0)) { ns.tprint("ERROR: workers missing from home."); return; }

  ns.disableLog("ALL");
  ns.ui.openTail();

  // --- the fleet ----------------------------------------------------------

  const fleet = () => {
    const seen = new Set(["home"]);
    const queue = ["home"];
    while (queue.length > 0) {
      const host = queue.pop();
      for (const next of ns.scan(host)) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    return [...seen].filter((h) => ns.hasRootAccess(h));
  };

  const freeRam = (host) =>
    ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - (host === "home" ? HOME_RESERVE : 0);

  const capacity = () => fleet().reduce((sum, h) => sum + Math.max(0, freeRam(h)), 0);

  /** Spread `threads` of `script` across the fleet. Returns how many actually started. */
  const place = (script, threads, delayMs) => {
    let left = Math.ceil(threads);
    for (const host of fleet()) {
      if (left <= 0) break;
      const fit = Math.floor(freeRam(host) / COST[script]);
      if (fit < 1) continue;
      const n = Math.min(fit, left);
      if (host !== "home") ns.scp(script, host, "home");
      // The last arg is a unique salt — without it the game rejects a second
      // copy of the same script with the same args on the same host.
      if (ns.exec(script, host, n, target, delayMs, `${Date.now()}-${Math.random()}`) !== 0) left -= n;
      else break;
    }
    return Math.ceil(threads) - left;
  };

  // --- prep: get to max money / min security before batching --------------

  const prep = async () => {
    for (;;) {
      const s = ns.getServer(target);
      const overSec = s.hackDifficulty - s.minDifficulty;
      const shortMoney = s.moneyMax - s.moneyAvailable;
      if (overSec < 0.05 && shortMoney < 1) return;

      const player = ns.getPlayer();
      const perWeaken = ns.formulas.hacking.weakenEffect(1);

      if (overSec > 0.05) {
        place(W, Math.ceil(overSec / perWeaken), 0);
      } else {
        const grows = Math.ceil(ns.formulas.hacking.growThreads(s, player, s.moneyMax));
        place(G, grows, 0);
        place(W, Math.ceil(ns.growthAnalyzeSecurity(grows, target) / perWeaken), 0);
      }

      ns.print(`prep: security +${overSec.toFixed(2)}, money ${(100 * s.moneyAvailable / s.moneyMax).toFixed(1)}%`);
      await ns.sleep(ns.formulas.hacking.weakenTime(s, player) + 500);
    }
  };

  // --- plan a batch, assuming the prepped state ---------------------------

  const plan = () => {
    const player = ns.getPlayer();
    const s = ns.getServer(target);
    s.hackDifficulty = s.minDifficulty;      // plan against the state prep guarantees
    s.moneyAvailable = s.moneyMax;

    const f = ns.formulas.hacking;
    const perWeaken = f.weakenEffect(1);

    const perThread = f.hackPercent(s, player);
    if (perThread <= 0) return null;

    const hackT = Math.max(1, Math.floor(STEAL / perThread));
    const stolen = hackT * perThread;
    const weaken1T = Math.ceil(ns.hackAnalyzeSecurity(hackT, target) / perWeaken);

    const growT = Math.ceil(f.growThreads({ ...s, moneyAvailable: s.moneyMax * (1 - stolen) }, player, s.moneyMax) * 1.05);
    const weaken2T = Math.ceil(ns.growthAnalyzeSecurity(growT, target) / perWeaken);

    const Th = f.hackTime(s, player), Tg = f.growTime(s, player), Tw = f.weakenTime(s, player);

    // Landings are t0, t0+GAP, t0+2GAP, t0+3GAP with t0 = Tw - GAP, which puts
    // the earliest start (weaken1) at exactly zero. Start = landing - duration.
    return {
      stolen,
      window: Tw + 3 * GAP,
      ram: hackT * COST[H] + growT * COST[G] + (weaken1T + weaken2T) * COST[W],
      ops: [
        { script: W, threads: weaken1T, delay: 0 },
        { script: W, threads: weaken2T, delay: 2 * GAP },
        { script: G, threads: growT,    delay: Math.max(0, Tw + GAP - Tg) },
        { script: H, threads: hackT,    delay: Math.max(0, Tw - GAP - Th) },
      ],
    };
  };

  // --- run ----------------------------------------------------------------

  ns.print(`prepping ${target}...`);
  await prep();

  let batches = 0, skipped = 0;

  for (;;) {
    const s = ns.getServer(target);

    // Desync guard. If security climbed or money fell, the durations we planned
    // with are wrong and every batch in flight is landing in the wrong order.
    if (s.hackDifficulty > s.minDifficulty + 1 || s.moneyAvailable < s.moneyMax * 0.9) {
      ns.print(`desynced after ${batches} batches - re-prepping`);
      await prep();
      batches = 0;
    }

    const p = plan();
    if (!p) { ns.print("target yields nothing at this level."); return; }

    if (p.ram > capacity()) {
      skipped++;
      if (skipped % 25 === 1) ns.print(`no room for a batch (${p.ram.toFixed(0)}GB needed, ${capacity().toFixed(0)}GB free)`);
    } else {
      for (const op of p.ops) place(op.script, op.threads, op.delay);
      batches++;
      if (batches % 20 === 0) ns.print(`${batches} batches, ${(p.stolen * 100).toFixed(1)}%/batch, ${p.ram.toFixed(0)}GB each`);
    }

    await ns.sleep(SPACING);
  }
}
