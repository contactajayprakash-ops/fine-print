import type { Brief } from "@/lib/types";
import example0 from "./cee-org-programs-research-science-institute-6c8c3e.json";
import example1 from "./davidsongifted-org-gifted-programs-fellows-scholarship-a8fe97.json";

// Briefs saved from real scans (see scripts/save-example.ts), so the home page has something to open
// even when storage is empty. Each file is exactly what the pipeline produced.
export const examples = [example0, example1] as unknown as Brief[];
