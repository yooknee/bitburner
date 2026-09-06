import { NS } from "@ns";
import { walk, tryRoot, rankTargets, freeRam } from "lib/net";
import * as fmt from "lib/fmt";

const WORKER = "early/grind.js";

/** GB left alone on home so you can still run things by hand. */
const HOME_RESERVE = 8;

/**
 * Root everything reachable, then fill every rooted server with copies of
 * `grind.js` pointed at the best target we can currently hack.
 *
 * Re-run it whenever your hacking level jumps or you buy a new .exe — it kills
 * and re-places the workers, so it's safe to run repeatedly.
 *
 * Usage: run early/deploy.js [target]
 */
export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");

  const network = walk(ns);
  const rooted = network.filter((host) => tryRoot(ns, host));

  const target = (ns.args[0] as string) ?? rankTargets(ns, rooted)[0];
  if (!target) {
    ns.tprint("ERROR: nothing worth hacking yet. Raise your hacking level and re-run.");
    return;
  }

  const cost = ns.getScriptRam(WORKER, "home");
  if (cost === 0) {
    ns.tprint(`ERROR: ${WORKER} isn't on home. Is \`npm run watch\` running and connected?`);
    return;
  }

  let totalThreads = 0;

  for (const host of [...rooted, "home"]) {
    if (!ns.hasRootAccess(host)) continue;

    // Clear out workers from a previous run so we can re-place them. Home is
    // left alone — you're probably running something there by hand.
    if (host !== "home") ns.killall(host);

    const available = freeRam(ns, host) - (host === "home" ? HOME_RESERVE : 0);
    const threads = Math.floor(available / cost);
    if (threads < 1) continue;

    if (host !== "home") ns.scp(WORKER, host, "home");
    if (ns.exec(WORKER, host, threads, target) !== 0) totalThreads += threads;
  }

  ns.tprint(
    `deployed ${totalThreads} threads against ${target} ` +
      `($${fmt.num(ns.getServerMaxMoney(target))} max, ` +
      `${ns.getServerMinSecurityLevel(target)} min security)`,
  );
}
