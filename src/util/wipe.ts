import { NS } from "@ns";

/**
 * Clear scripts off a server so the next sync can repopulate it cleanly.
 *
 * usage: run util/wipe.js [host] [txt]
 *
 * Deletes .js and .script only. Add the literal argument `txt` to also clear
 * generated .txt files.
 *
 * It deliberately will NOT touch:
 *   .exe  - your port openers and programs. Re-earning BruteSSH.exe is hours.
 *   .cct  - unsolved coding contracts. Deleting one forfeits its reward.
 *   .lit / .msg - lore and story files you can't get back.
 *
 * `rm *` doesn't exist in the game's terminal, and this is why that's a mercy.
 */
export async function main(ns: NS): Promise<void> {
  const host = (ns.args[0] as string) ?? "home";
  const alsoText = ns.args.includes("txt");

  const self = ns.getScriptName();
  const deletable = alsoText ? [".js", ".script", ".txt"] : [".js", ".script"];

  const running = ns.ps(host).filter((p) => p.filename !== self);
  if (running.length > 0) {
    ns.tprint(`ERROR: ${running.length} script(s) still running on ${host}. Run \`killall\` first.`);
    for (const p of running.slice(0, 5)) ns.tprint(`  ${p.filename} (pid ${p.pid})`);
    return;
  }

  const all = ns.ls(host);
  const removed: string[] = [];
  const kept: string[] = [];

  for (const file of all) {
    if (file === self) continue;                                  // deleted by the resync anyway
    if (!deletable.some((ext) => file.endsWith(ext))) { kept.push(file); continue; }
    if (ns.rm(file, host)) removed.push(file);
    else kept.push(file);
  }

  ns.tprint(`wiped ${removed.length} file(s) from ${host}`);
  if (kept.length > 0) ns.tprint(`kept ${kept.length}: ${kept.join(", ")}`);
  ns.tprint("reconnect the Remote API to repopulate from dist/");
}
