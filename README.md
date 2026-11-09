# Fine Print

Paste a link to a hackathon, scholarship or summer program. Fine Print reads the rules, the FAQ and every other page that matters, then tells you:

- the real deadline, converted to your time zone
- whether you can enter, checked against your age, school level and country
- what you could win, with cash separated from credits and subscriptions
- what you have to hand in, as a checklist
- anything worth a second look: fees, rights grabs, and places where two pages contradict each other

Every line links back to the exact sentence it came from.

**Live:** _added after first deploy_

## Why I built it

Student opportunities are spread across an overview page, a rules page, an FAQ and sometimes a PDF, and those pages don't always agree. While reading the pages for IceHacks itself I found the overview listing prizes "in cash" a few screens below a banner saying there are no cash prizes, and a demo video that is required on one page and optional on another. Nobody reads all of that carefully before signing up. I wanted a tool that does.

## How it works

1. **Find the pages.** The link you paste is scraped with [Anakin](https://anakin.io)'s URL Scraper while Anakin's Map endpoint lists the rest of the site. `lib/links.ts` scores every candidate (rules, eligibility, prizes, dates, FAQ, fees) and keeps the best seven.
2. **Read them.** Those pages go to Anakin's batch scraper in one job. The markdown that comes back is flattened into plain text blocks, with repeated sections removed.
3. **Draft the brief.** Gemini gets all pages at once with a strict JSON schema (`lib/extract.ts`). For every fact it has to give the page number and a word-for-word quote. It is also asked to compare each pair of pages for statements that can't both be true.
4. **Check the draft.** This is the part I care about most. `lib/verify.ts` looks for every quote on the page it supposedly came from. Matching is done on words only, so punctuation and markdown don't matter, but the words have to be there in order. A fact with no confirmed quote is deleted. A contradiction needs both of its quotes confirmed. The brief reports how many quotes were checked and how many were thrown out.
5. **Pin the deadline.** The model copies the time as written and names the zone. The conversion to an absolute time is done in code (`lib/time.ts`), not by the model, and the browser shows it in your zone. A deadline with no zone is flagged automatically.

Briefs are stored (Vercel Blob in production, a local folder in development) so they have a permanent link, and a brief less than a day old is reused instead of scraped again.

## Sponsor tech

**Anakin** does all the web access. Three endpoints are used: `POST /v1/url-scraper` for the first page, `POST /v1/map` to discover the site, and `POST /v1/url-scraper/batch` to read the chosen pages in one request. See `lib/anakin.ts`. A full scan costs about 8 credits.

## Stack

- Next.js 16 (App Router) and React 19, TypeScript, plain CSS
- Anakin for scraping, Gemini (`gemini-3.8-flash`, falling back to older Flash models) for extraction
- Vercel for hosting, Vercel Blob for storage
- Atkinson Hyperlegible Next for the interface and Source Serif 4 for quoted text, both self-hosted through Fontsource
- No UI kit and no database

## Run it yourself

```bash
git clone https://github.com/contactajayprakash-ops/fine-print
cd fine-print
npm install
cp .env.example .env.local   # add your Anakin and Gemini keys
npm run dev
```

Other commands:

```bash
npm test                              # quote matching, time zones, page picking, verification
npm run scan -- https://example.com   # one scan from the terminal, prints the brief as JSON
```

## What it doesn't do

- It can't log in, and it doesn't read PDFs yet. If the rules are in a PDF, the brief will say less than it should.
- It reads at most eight pages per site.
- A contradiction is only reported when both sentences are on pages it read. It will miss ones that depend on a page it skipped.
- The eligibility check understands age, school level and country. Everything else is marked "check yourself".
- Fresh scans are capped per day because scraping credits are limited. Existing briefs always open.
- It is a reading aid. It is not legal advice, and a clean brief is not a guarantee.

## AI use

IceHacks asks entrants to disclose this, so plainly: I built Fine Print with Claude (Anthropic) as a coding assistant, and it wrote most of the code. I chose the idea, directed the work and tested it. The app itself calls Gemini at runtime to read pages. Everything in this repository was started during the hacking period (November 8 to 15, 2026).

## License

MIT
