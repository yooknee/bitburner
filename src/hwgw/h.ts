import { NS } from "@ns";

/**
 * Single-purpose worker: sleep, then do exactly one thing.
 *
 * It knows nothing and decides nothing. Every NS function is charged per
 * thread and we run thousands of threads, so anything beyond the one call
 * costs real fleet capacity.
 *
 * args: [target, delayMs, salt] — the salt is ignored, but the game refuses to
 * start a second copy of a script with identical args on the same host, and
 * batches overlap by design.
 */
export async function main(ns: NS): Promise<void> {
  const target = ns.args[0] as string;
  const delayMs = ns.args[1] as number;

  await ns.sleep(delayMs);
  await ns.hack(target);
}
