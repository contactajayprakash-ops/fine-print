import Link from "next/link";

export default function NotFound() {
  return (
    <main className="sheet">
      <div className="sheet-pad">
        <section className="row">
          <div className="aside" />
          <div className="main">
            <h1 className="brief-title">There&rsquo;s no brief at this address.</h1>
            <p className="brief-summary">
              It may have been mistyped, or the link was never scanned. <Link href="/">Paste the original link</Link> and Fine Print
              will read it now.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
