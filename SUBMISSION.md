# Fine Print

**Tagline:** Paste a link to a hackathon, scholarship or summer program. Fine Print reads every page and tells you the deadline, who can enter, what you win, and where the pages contradict each other.

**Live:** https://fine-print-kappa.vercel.app
**Code:** https://github.com/contactajayprakash-ops/fine-print

## Inspiration

Before I started on this hackathon I read the IceHacks pages closely, and they didn't agree with each other. The overview has a note saying there are no cash prizes. A few screens further down, the prize list gives first place "$150 in cash". The overview says a project without a demo video won't be judged, and the rules page calls the video optional. Nobody did this on purpose. Pages get edited at different times and nobody rereads all of them together. But the person who finds out is the student, usually late on deadline day.

Scholarships and summer programs are harder, because the rules are longer and a mistake costs more. I wanted a tool that reads all of it and shows me where to look.

## What it does

You paste a link. Fine Print finds the pages that matter (rules, FAQ, prizes, dates), reads them, and gives you one page back:

- The deadline, converted to your time zone, with a countdown.
- Who can enter. Type your age, school level and country, and each rule is marked "You fit", "You don't fit" or "Check yourself".
- What you could get, with cash kept apart from credits and subscriptions.
- What to hand in, as a checklist you can tick off.
- Things to check before you commit: fees, terms that claim your work, prizes with strings attached, and places where two pages contradict each other. For a contradiction it shows both sentences side by side and doesn't guess which is right.
- Questions the pages never answer, with a button that turns them into an email to the organizer.

Every line has a Source button. It shows the sentence the claim came from and opens the original page scrolled to that sentence.

On IceHacks it flags the cash prizes and the demo video in about 100 seconds. On the Research Science Institute it noticed that the FAQ asks for three recommendation letters while the application page asks for two.

## How I built it

It's a Next.js 16 app on Vercel. A scan has four steps.

**Find.** Anakin's URL Scraper fetches the page you pasted while Anakin's Map endpoint lists the rest of the site. My code scores every link by what its address and link text mention (rules, eligibility, prizes, fees, dates), throws out press releases and staff pages, and keeps up to seven. Anakin's batch scraper reads those in one job.

**Read.** Gemini 3.6 Flash gets every page at once, with a strict JSON schema. Two requests run side by side. One copies down the facts. The other lists the prizes and compares every place the pages mention the same thing. For each item the model has to give a page number and a word-for-word quote.

**Check.** This part is plain code. Every quote is searched for on the page it supposedly came from, matching on words so punctuation and markdown don't matter. If the words aren't there, the claim is deleted before anyone sees it. The brief tells you how many quotes were checked and how many were thrown out.

**Doubt.** A contradiction is the strongest thing the app says about someone else's website, so each one goes to a second Gemini call that sees only the two passages and has to agree they conflict.

The deadline is handled the same way. The model copies the time as written, and code does the time zone math. A deadline with no time zone gets flagged automatically.

There's no UI kit. The design is a marked-up document: a white sheet, a red margin rule like a legal pad, highlighter over quotes, sticky flags in the margin. The app's own words are set in Atkinson Hyperlegible and anything quoted from a page is in Source Serif, so you can always tell an answer from its evidence.

## Challenges I ran into

Gemini's free tier was the hardest part. The same request took 20 seconds one minute and timed out at 80 the next, and one evening all three models I tried failed in a row. I split the work into two smaller parallel requests, and if the first model hasn't answered after 22 seconds a second one starts alongside it and the faster answer wins.

The model also wanted to call things contradictions that weren't. "Recommendations by two teachers" and "a maximum of three letters" can both be true. That's why the second reader exists. On the IceHacks scan in the video it threw out two of four claims. One of those was "open to students" against "open to high school students", which I think is a fair thing to ask about, so it now shows up as an open question instead.

Scraped pages repeat themselves. The IceHacks overview came back with whole sections three times over, so I remove repeated blocks before the model sees them.

## Accomplishments that I'm proud of

On that IceHacks scan, 53 quotes were checked against the pages and every one was found word for word. If one had been made up, the app would have caught it and thrown the claim out, and that check is the part I'm proudest of.

In one test run it also caught something I had missed when I read the pages myself: the rules require a public GitHub repo, while the overview accepts a repo or a live link.

And it's a real deployed product. Anyone can paste a link right now.

## What I learned

Use the model to draft and code to verify. Asking a model to "be accurate" did much less than refusing to show anything it couldn't quote.

Don't let a model do arithmetic on dates. It copies "6:00 PM PT" well and converts it badly.

Free model tiers need the same engineering as a flaky network: timeouts, retries, and a second route.

## What's next

- Read PDFs, since a lot of scholarship rules live in one.
- Permanent storage. Right now new briefs sit in Vercel's runtime cache for up to 30 days; the three examples on the home page are permanent.
- Watch a page and tell you when the deadline or the rules change.
- A browser extension, so the brief is one click from the page you're already on.

## What it doesn't do

It can't log in and it doesn't read PDFs. It reads at most eight pages per site, and it only reports a contradiction when both sentences are on pages it read. Results can differ a little between runs, because the model doesn't notice the same things every time. It's a reading aid. It isn't legal advice, and a clean brief isn't a guarantee.

## AI use

I built Fine Print with Claude as a coding assistant, and it wrote most of the code. I picked the idea and made the product decisions. The app itself calls Gemini at runtime. Everything was started during the hacking period.

## Built with

next.js, react, typescript, vercel, anakin, gemini, css
