import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/source-serif-4/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "Fine Print", template: "%s | Fine Print" },
  description:
    "Paste a link to a hackathon, scholarship or program. Fine Print reads every page and tells you the deadline, who can enter, what you win, and where the pages contradict each other.",
};

export const viewport: Viewport = { themeColor: "#dfe5ec" };

const REPO = "https://github.com/contactajayprakash-ops/fine-print";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="wordmark">
            <span>Fine Print</span>
          </Link>
          <nav aria-label="Site">
            <Link href="/#examples">Examples</Link>
            <Link href="/#how">How it works</Link>
            <a href={REPO}>Code</a>
          </nav>
        </header>
        {children}
        <footer className="site-foot">
          <span>Fine Print reads public pages with an AI model. It can miss things, so every answer links to the sentence it came from.</span>
          <span>
            Pages fetched with <a href="https://anakin.io">Anakin</a>, read with Gemini. Built for IceHacks 2026.
          </span>
        </footer>
      </body>
    </html>
  );
}
