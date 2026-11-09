import Link from "next/link";
import { ScanForm } from "@/components/ScanForm";
import { examples } from "@/data/examples";
import { around, flagTally, hostOf, KIND_LABEL, pageLabel } from "@/lib/format";
import type { Brief, Flag } from "@/lib/types";

/** Pick one real contradiction from the saved examples to show on the front page. */
function findCatch(): { brief: Brief; flag: Flag } | null {
  for (const brief of examples) {
    const flag = brief.flags.find((f) => f.type === "contradiction" && f.evidence.length >= 2);
    if (flag) return { brief, flag };
  }
  return null;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { url } = await searchParams;
  const caught = findCatch();

  return (
    <main className="sheet">
      <div className="sheet-pad">
        <section className="row">
          <div className="aside" />
          <div className="main">
            <h1 className="home-title">Find out what you&rsquo;re signing up for.</h1>
            <p className="home-lede">
              Paste a link to a hackathon, scholarship or summer program. Fine Print reads the rules, FAQ and every other page that
              matters, then tells you the real deadline, whether you can enter, what you&rsquo;d win, and where the pages disagree
              with each other.
            </p>
            <ScanForm initialUrl={typeof url === "string" ? url : ""} />
          </div>
        </section>

        {caught && (
          <section className="row" aria-labelledby="catch">
            <div className="aside">
              <h2 id="catch">
                Something it caught
                <span className="count">{caught.brief.title}</span>
              </h2>
            </div>
            <div className="main">
              <div className="specimen">
                {caught.flag.evidence.slice(0, 2).map((e, i) => {
                  const { before, quote, after } = around(e);
                  return (
                    <figure key={i}>
                      <figcaption>{pageLabel(caught.brief.pages[e.page]?.url ?? caught.brief.url)}</figcaption>
                      <blockquote>
                        {before.slice(-220)}
                        <mark>{quote}</mark>
                        {after.slice(0, 220)}
                      </blockquote>
                    </figure>
                  );
                })}
                <p className="specimen-verdict">
                  <strong>{caught.flag.title}.</strong> {caught.flag.explanation}{" "}
                  <Link href={`/b/${caught.brief.id}`}>Open the full brief</Link>
                </p>
              </div>
            </div>
          </section>
        )}

        {examples.length > 0 && (
          <section className="row" id="examples" aria-labelledby="examples-h">
            <div className="aside">
              <h2 id="examples-h">Briefs you can open now</h2>
            </div>
            <div className="main">
              <ul className="example-list">
                {examples.map((b) => (
                  <li key={b.id}>
                    <Link href={`/b/${b.id}`}>
                      <span className="name">{b.title}</span>
                      <span className="sub">
                        {KIND_LABEL[b.kind]} on {hostOf(b.url)}, {b.pages.length} {b.pages.length === 1 ? "page" : "pages"} read
                      </span>
                      <span className="tally">{flagTally(b)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="row" id="how" aria-labelledby="how-h">
          <div className="aside">
            <h2 id="how-h">How it works</h2>
          </div>
          <div className="main">
            <ol className="steps">
              <li>
                <span>
                  <strong>It finds the pages that matter.</strong> Starting from your link, it maps the site and picks out rules,
                  eligibility, prizes, dates and FAQ pages.
                </span>
              </li>
              <li>
                <span>
                  <strong>It reads all of them side by side.</strong> An AI model pulls out the deadline, requirements, prizes and what
                  you have to submit, and looks for places where two pages can&rsquo;t both be right.
                </span>
              </li>
              <li>
                <span>
                  <strong>It checks its own work.</strong> Every claim has to point at a sentence that is really on the page. If the
                  sentence isn&rsquo;t there, the claim is thrown out before you see it.
                </span>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
