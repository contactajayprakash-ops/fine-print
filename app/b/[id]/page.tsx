import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskOrganizer } from "@/components/AskOrganizer";
import { BriefActions } from "@/components/BriefActions";
import { Checklist } from "@/components/Checklist";
import { Deadline } from "@/components/Deadline";
import { Eligibility } from "@/components/Eligibility";
import { Quote, Quotes } from "@/components/Source";
import { Sourced } from "@/components/Sourced";
import { asWritten, flagTally, hostOf, KIND_LABEL, pageLabel, PRIZE_LABEL } from "@/lib/format";
import { loadBrief } from "@/lib/store";
import type { Brief, Flag, Prize } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/b/[id]">): Promise<Metadata> {
  const { id } = await params;
  const brief = await loadBrief(id);
  if (!brief) return { title: "Brief not found" };
  return { title: brief.title, description: `${flagTally(brief)}. ${brief.summary}` };
}

const TAB = { high: "Serious", medium: "Ask about this", low: "Good to know" } as const;

/** The email a reader can send: one question per contradiction, then everything the pages leave out. */
function organizerEmail(brief: Brief): string {
  const questions: string[] = [];
  for (const flag of brief.flags) {
    if (flag.type !== "contradiction" || flag.evidence.length < 2) continue;
    const [a, b] = flag.evidence;
    questions.push(
      `${pageLabel(brief.pages[a.page]?.url ?? brief.url)} says "${a.quote}" but ${pageLabel(brief.pages[b.page]?.url ?? brief.url)} says "${b.quote}" Which one is right?`,
    );
  }
  for (const q of brief.openQuestions) questions.push(q.question);
  return [
    "Hi,",
    "",
    `I'm planning to take part in ${brief.title} and a few things on the site aren't clear to me:`,
    "",
    ...questions.map((q, i) => `${i + 1}. ${q}`),
    "",
    "Thanks for your help.",
  ].join("\n");
}

function groupPrizes(prizes: Prize[]): [string, Prize[]][] {
  const groups = new Map<string, Prize[]>();
  for (const p of prizes) {
    const name = p.name || "Prizes";
    groups.set(name, [...(groups.get(name) ?? []), p]);
  }
  return [...groups.entries()];
}

function FlagRow({ flag, brief }: { flag: Flag; brief: Brief }) {
  const split = flag.type === "contradiction" && flag.evidence.length >= 2;
  return (
    <article className="row flag">
      <div className="aside">
        <span className={`tab ${flag.severity}`}>{TAB[flag.severity]}</span>
      </div>
      <div className="main">
        <h3>{flag.title}</h3>
        <p className="explain">{flag.explanation}</p>
        {split ? (
          <div className="sides">
            {flag.evidence.slice(0, 2).map((e, i) => (
              <div className="side" key={i}>
                <p className="from">
                  {pageLabel(brief.pages[e.page]?.url ?? brief.url)}
                  {e.section ? `, under “${e.section}”` : ""}
                </p>
                <blockquote>
                  <mark className="pink">{e.quote}</mark>
                </blockquote>
                <a href={e.href} target="_blank" rel="noopener noreferrer">
                  Open the page at this sentence
                </a>
              </div>
            ))}
          </div>
        ) : (
          flag.evidence.map((e, i) => <Quote key={i} evidence={e} pages={brief.pages} />)
        )}
      </div>
    </article>
  );
}

export default async function BriefPage({ params }: PageProps<"/b/[id]">) {
  const { id } = await params;
  const brief = await loadBrief(id);
  if (!brief) notFound();

  const scanned = new Date(brief.scannedAt);
  const cash = brief.prizes.filter((p) => p.kind === "cash").length;
  const hasQuestions = brief.openQuestions.length > 0 || brief.flags.some((f) => f.type === "contradiction");

  return (
    <main className="sheet">
      <div className="sheet-pad">
        <header className="row">
          <div className="aside" />
          <div className="main">
            <p className="brief-kind">
              {KIND_LABEL[brief.kind]}
              {brief.organizer ? ` from ${brief.organizer}` : ""}
            </p>
            <h1 className="brief-title">{brief.title}</h1>
            <p className="brief-summary">{brief.summary}</p>
            <p className="brief-source">
              Read from <a href={brief.url}>{hostOf(brief.url)}</a> on{" "}
              <time dateTime={brief.scannedAt}>
                {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(scanned)}
              </time>
              . Pages change, so check anything you&rsquo;re relying on.
            </p>
            <BriefActions sourceUrl={brief.url} scannedAt={brief.scannedAt} />
          </div>
        </header>

        <section className="row" aria-labelledby="deadline-h">
          <div className="aside">
            <h2 id="deadline-h">Deadline</h2>
          </div>
          <div className="main">
            {brief.deadline ? (
              <>
                <Deadline when={brief.deadline} />
                <Sourced align="start" quotes={<Quotes evidence={brief.deadline.evidence} pages={brief.pages} />} />
              </>
            ) : (
              <p className="answer-sub">None of the pages give a deadline. Ask before you plan around one.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="flags-h" className="row" style={{ display: "block" }}>
          <div className="row">
            <div className="aside">
              <h2 id="flags-h">
                Check before you commit
                <span className="count">{flagTally(brief)}</span>
              </h2>
            </div>
            <div className="main">
              {brief.flags.length === 0 ? (
                <p className="all-clear">
                  Nothing on these pages contradicts itself, asks for money or claims your work. That isn&rsquo;t a guarantee, only
                  what {brief.pages.length} {brief.pages.length === 1 ? "page says" : "pages say"}.
                </p>
              ) : (
                <p>
                  These come straight from the pages, with the organizer&rsquo;s own words quoted. Where two passages disagree, both
                  are shown and neither is assumed to be the right one.
                </p>
              )}
            </div>
          </div>
          {brief.flags.map((flag, i) => (
            <FlagRow key={i} flag={flag} brief={brief} />
          ))}
        </section>

        {(brief.eligibility.length > 0 || brief.team) && (
          <section className="row" aria-labelledby="who-h">
            <div className="aside">
              <h2 id="who-h">Who can enter</h2>
            </div>
            <div className="main">
              {brief.eligibility.length > 0 && (
                <Eligibility
                  requirements={brief.eligibility}
                  quotes={brief.eligibility.map((r, i) => (
                    <Quotes key={i} evidence={r.evidence} pages={brief.pages} />
                  ))}
                />
              )}
              {brief.team && (
                <div style={{ marginTop: brief.eligibility.length ? 14 : 0 }}>
                  <Sourced quotes={<Quotes evidence={brief.team.evidence} pages={brief.pages} />}>
                    <strong>Teams:</strong> {brief.team.text}
                  </Sourced>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="row" aria-labelledby="cost-h">
          <div className="aside">
            <h2 id="cost-h">What it costs</h2>
          </div>
          <div className="main">
            {brief.costs.length === 0 ? (
              <p>No fee is mentioned on any page read. That usually means free, but the pages don&rsquo;t say so outright.</p>
            ) : (
              <ul className="lines">
                {brief.costs.map((c, i) => (
                  <li key={i}>
                    <Sourced
                      quotes={<Quotes evidence={c.evidence} pages={brief.pages} />}
                      badge={c.amount ? <span className={`kind${/free/i.test(c.amount) ? " cash" : ""}`}>{c.amount}</span> : null}
                    >
                      {c.text}
                    </Sourced>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {brief.prizes.length > 0 && (
          <section className="row" aria-labelledby="prizes-h">
            <div className="aside">
              <h2 id="prizes-h">What you could get</h2>
            </div>
            <div className="main">
              <p className="tally-line">
                {cash === 0
                  ? "None of the listed prizes is money."
                  : `${cash} of the ${brief.prizes.length} listed prizes ${cash === 1 ? "is" : "are"} described as cash. The rest are credits, subscriptions or similar.`}
              </p>
              {groupPrizes(brief.prizes).map(([name, prizes]) => (
                <div className="prize-group" key={name}>
                  <h3>{name}</h3>
                  <ul className="lines">
                    {prizes.map((p, i) => (
                      <li key={i}>
                        <Sourced
                          quotes={<Quotes evidence={p.evidence} pages={brief.pages} />}
                          badge={<span className={`kind${p.kind === "cash" ? " cash" : ""}`}>{PRIZE_LABEL[p.kind]}</span>}
                        >
                          {p.value}
                          {p.conditions && <span className="muted small"> ({p.conditions})</span>}
                        </Sourced>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {brief.submission.length > 0 && (
          <section className="row" aria-labelledby="submit-h">
            <div className="aside">
              <h2 id="submit-h">What to hand in</h2>
            </div>
            <div className="main">
              <Checklist
                briefId={brief.id}
                items={brief.submission}
                quotes={brief.submission.map((s, i) => (
                  <Quotes key={i} evidence={s.evidence} pages={brief.pages} />
                ))}
              />
            </div>
          </section>
        )}

        {brief.judging.length > 0 && (
          <section className="row" aria-labelledby="judging-h">
            <div className="aside">
              <h2 id="judging-h">How it&rsquo;s judged</h2>
            </div>
            <div className="main">
              <ul className="lines">
                {brief.judging.map((j, i) => (
                  <li key={i}>
                    <Sourced quotes={<Quotes evidence={j.evidence} pages={brief.pages} />}>
                      <strong>{j.name}</strong>
                      {j.detail && <span>: {j.detail}</span>}
                    </Sourced>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {brief.dates.length > 0 && (
          <section className="row" aria-labelledby="dates-h">
            <div className="aside">
              <h2 id="dates-h">Other dates</h2>
            </div>
            <div className="main">
              <ul className="lines">
                {brief.dates.map((d, i) => (
                  <li key={i}>
                    <Sourced quotes={<Quotes evidence={d.evidence} pages={brief.pages} />}>
                      <strong>{d.label}</strong>
                      <span className="when-at">
                        {asWritten(d.local, d.hasTime)}
                        {d.zoneText ? ` ${d.zoneText}` : ""}
                      </span>
                    </Sourced>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {hasQuestions && (
          <section className="row" aria-labelledby="open-h">
            <div className="aside">
              <h2 id="open-h">
                Not answered anywhere
                <span className="count">Worth asking the organizer</span>
              </h2>
            </div>
            <div className="main">
              {brief.openQuestions.length > 0 && (
                <ul className="questions">
                  {brief.openQuestions.map((q, i) => (
                    <li key={i}>
                      <p className="q">{q.question}</p>
                      {q.why && <p className="muted small">{q.why}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <AskOrganizer subject={`Questions about ${brief.title}`} body={organizerEmail(brief)} email={brief.contact?.email ?? null} />
            </div>
          </section>
        )}

        <section className="row" aria-labelledby="pages-h">
          <div className="aside">
            <h2 id="pages-h">Pages read</h2>
          </div>
          <div className="main">
            <ul className="pages-read">
              {brief.pages.map((p, i) => (
                <li key={i}>
                  <a href={p.url}>{pageLabel(p.url)}</a>
                  <span>{p.chars.toLocaleString("en-US")} characters</span>
                </li>
              ))}
            </ul>
            <p className="method">
              {brief.stats.quotesChecked} quotes were checked against these pages.{" "}
              {brief.stats.quotesDropped === 0
                ? "All of them were found word for word."
                : `${brief.stats.quotesDropped} could not be found and ${brief.stats.quotesDropped === 1 ? "was" : "were"} removed, along with anything that depended on ${brief.stats.quotesDropped === 1 ? "it" : "them"}.`}{" "}
              {brief.stats.contradictionsOverruled
                ? `A second reader looked at each claimed contradiction and threw out ${brief.stats.contradictionsOverruled} that didn\u2019t hold up. `
                : ""}
              This is a reading aid, not legal advice.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
