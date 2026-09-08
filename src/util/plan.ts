import { NS } from "@ns";
import { planBatch, saturationRam, workerCosts } from "lib/hwgw";
import * as fmt from "lib/fmt";

/** What one batch against a target would cost and yield. */
export async function main(ns: NS): Promise<void> {
  const target = ns.args[0] as string;
  if (!target) { ns.tprint("usage: run util/plan.js <target> [stealFraction]"); return; }

  const steal = (ns.args[1] as number) ?? 0.1;
  const batch = planBatch(ns, target, steal, workerCosts(ns));
  if (!batch) { ns.tprint(`${target} yields nothing at your level.`); return; }

  const money = (ns.getServer(target).moneyMax ?? 0) * batch.stolen;
  const names = ["weaken1", "weaken2", "grow", "hack"];

  ns.tprint(`${target} - ${(batch.stolen * 100).toFixed(1)}% per batch`);
  batch.ops.forEach((op, i) =>
    ns.tprint(`  ${names[i].padEnd(8)}${String(op.threads).padStart(6)} threads  start +${(op.delay / 1000).toFixed(1)}s`));
  ns.tprint(`  ---`);
  ns.tprint(`  RAM per batch   ${fmt.ram(batch.ram)}`);
  ns.tprint(`  batch window    ${(batch.window / 1000).toFixed(1)}s`);
  ns.tprint(`  yield/batch     $${fmt.num(money)}`);
  ns.tprint(`  target absorbs  ${fmt.ram(saturationRam(batch))} before extra RAM is wasted`);
}
