// Run one scan from the terminal and print the brief.
//   npx tsx --env-file=.env.local scripts/scan.ts https://example.com/contest
import { normalizeUrl } from "../lib/links";
import { runScan } from "../lib/pipeline";

const url = normalizeUrl(process.argv[2] ?? "");
if (!url) {
  console.error("Usage: scan.ts <url>");
  process.exit(1);
}

runScan(url, (event) => console.error(JSON.stringify(event)))
  .then((brief) => console.log(JSON.stringify(brief, null, 2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
