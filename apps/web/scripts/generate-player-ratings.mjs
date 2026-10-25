import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPlayerRatings } from "./match-tables.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

function parseCsv(text) {
  const records = [];
  let record = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"' && value.length === 0) quoted = true;
    else if (character === ",") {
      record.push(value);
      value = "";
    } else if (character === "\n") {
      record.push(value.replace(/\r$/, ""));
      if (record.some((cell) => cell.length > 0)) records.push(record);
      record = [];
      value = "";
    } else value += character;
  }
  if (value.length > 0 || record.length > 0) {
    record.push(value.replace(/\r$/, ""));
    if (record.some((cell) => cell.length > 0)) records.push(record);
  }
  const [headers, ...rows] = records;
  if (!headers) return [];
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n") + "\n";
}

const events = parseCsv(readFileSync(join(DATA_DIR, "events.csv"), "utf8"));
const frames = parseCsv(readFileSync(join(DATA_DIR, "frames.csv"), "utf8"));
const people = parseCsv(readFileSync(join(DATA_DIR, "people.csv"), "utf8"));
const { rows, headers } = buildPlayerRatings(events, frames, people);
writeFileSync(join(DATA_DIR, "player-ratings.csv"), toCsv(headers, rows));
console.log(`Wrote ${rows.length} player rating rows to ${DATA_DIR}/player-ratings.csv`);
