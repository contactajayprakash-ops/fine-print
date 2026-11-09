// Copy a finished brief into data/examples so it ships with the site.
//   npx tsx scripts/save-example.ts <brief.json>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import type { Brief } from "../lib/types";

const brief = JSON.parse(readFileSync(process.argv[2], "utf8")) as Brief;
writeFileSync(`data/examples/${brief.id}.json`, JSON.stringify(brief, null, 2) + "\n");

const files = readdirSync("data/examples").filter((f) => f.endsWith(".json")).sort();
const names = files.map((_, i) => `example${i}`);
writeFileSync(
  "data/examples/index.ts",
  [
    'import type { Brief } from "@/lib/types";',
    ...files.map((f, i) => `import ${names[i]} from "./${f}";`),
    "",
    "// Briefs saved from real scans (see scripts/save-example.ts), so the home page has something to open",
    "// even when storage is empty. Each file is exactly what the pipeline produced.",
    `export const examples = [${names.join(", ")}] as unknown as Brief[];`,
    "",
  ].join("\n"),
);
console.log(`saved ${brief.id}; ${files.length} example(s)`);
