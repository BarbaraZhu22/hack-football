/** Generate only the curated Premier League precedent table. */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRECEDENTS, PRECEDENT_HEADERS } from "./precedents-catalog.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(scriptDir, "..", "data");
const csvEscape = (value) => {
  const cell = value === null || value === undefined ? "" : String(value);
  return /[\",\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
};
const rows = PRECEDENTS.map((row) => ({
  ...row,
  law_refs: JSON.stringify(row.law_refs),
  tags: JSON.stringify(row.tags),
}));
const csv = [
  PRECEDENT_HEADERS.join(","),
  ...rows.map((row) => PRECEDENT_HEADERS.map((key) => csvEscape(row[key])).join(",")),
].join("\n") + "\n";
writeFileSync(join(dataDir, "precedents.csv"), csv);
console.log(`Wrote ${rows.length} precedents to ${join(dataDir, "precedents.csv")}`);
