/**
 * Hand-rolled formatters, on purpose.
 *
 * The game's own helpers moved from `ns.formatNumber()` / `ns.formatRam()` to
 * `ns.format.number()` / `ns.format.ram()`, so which one exists depends on your
 * Bitburner version. These are plain JS, work everywhere, and cost 0GB.
 */

const SUFFIXES = ["", "k", "m", "b", "t", "q"];

/** 1234567 -> "1.235m" */
export function num(value: number, digits = 3): string {
  const sign = value < 0 ? "-" : "";
  let n = Math.abs(value);
  let tier = 0;

  while (n >= 1000 && tier < SUFFIXES.length - 1) {
    n /= 1000;
    tier++;
  }

  return sign + n.toFixed(tier === 0 ? 0 : digits) + SUFFIXES[tier];
}

/** 1024 -> "1.00TB" */
export function ram(gb: number): string {
  const units = ["GB", "TB", "PB"];
  let n = gb;
  let tier = 0;

  while (n >= 1024 && tier < units.length - 1) {
    n /= 1024;
    tier++;
  }

  return (tier === 0 ? n.toFixed(0) : n.toFixed(2)) + units[tier];
}
