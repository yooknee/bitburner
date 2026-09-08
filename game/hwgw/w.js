/**
 * Single-purpose worker: sleep, then do exactly one thing.
 *
 * It knows nothing and decides nothing — that's the point. Every NS function
 * here is charged per thread, and we run thousands of threads, so anything
 * beyond the one call would cost real fleet capacity.
 *
 * args: [target, delayMs, salt]
 * The salt is ignored. It exists because the game refuses to start a second
 * copy of a script with identical args on the same host, and batches overlap.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const [target, delayMs] = ns.args;
  await ns.sleep(delayMs);
  await ns.weaken(target);
}
