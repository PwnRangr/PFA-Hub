import { useEffect, useRef } from "react";

// Same palette as App.jsx's own `C` — duplicated here rather than imported
// since App.jsx has no exports of its own to pull from.
const C = {
  line: "#243450",
  slate: "#8494AC",
  gold: "#E8A33D",
};

// Ko-fi's own embed snippet is two <script> tags meant to sit directly in
// static HTML: the second one calls kofiwidget2.draw(), which works by
// document.write()-ing the button at that exact point in the page — that
// only works during the browser's initial synchronous HTML parse. Called
// from a React effect (i.e. after the page has already loaded), document.write
// wipes the entire page instead of drawing a button. kofiwidget2.getHTML()
// is Ko-fi's own documented alternative for exactly this case — it returns
// the button's markup as a string instead of writing it inline, so it's
// safe to insert normally (via a ref) any time after mount.
const KOFI_SCRIPT_SRC = "https://storage.ko-fi.com/cdn/widget/Widget_2.js";

function KofiButton() {
  const hostRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const draw = () => {
      if (cancelled || !hostRef.current || !window.kofiwidget2) return;
      window.kofiwidget2.init("Support me on Ko-fi", "#0e08c2", "L7F223E9TZ");
      hostRef.current.innerHTML = window.kofiwidget2.getHTML();
    };

    if (window.kofiwidget2) {
      draw();
      return;
    }

    // Footer only ever mounts once per page load (App.jsx renders it
    // outside the tab-switching view blocks, so it isn't remounted when
    // the person switches tabs) — this existence check is just a safety
    // net against loading the script twice, not something relied on for
    // normal operation.
    let script = document.querySelector(`script[src="${KOFI_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = KOFI_SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", draw);
    return () => {
      cancelled = true;
      script.removeEventListener("load", draw);
    };
  }, []);

  return <div ref={hostRef} style={{ lineHeight: 0 }} />;
}

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-4 sm:px-6 py-4 text-xs" style={{ borderTop: `1px solid ${C.line}`, color: C.slate }}>
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        <div className="flex justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span>Painless Football Alliance</span>
            <KofiButton />
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>sleeper api · firebase · alliance sheet</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
          <span>© {year} Painless Football Alliance. All rights reserved.</span>
          <div className="flex-1" />
          <FooterLink href="/terms">Terms of Service</FooterLink>
          <FooterLink href="/privacy">Privacy Policy</FooterLink>
          <FooterLink href="/aup">Acceptable Use</FooterLink>
          <span style={{ color: C.line }}>|</span>
          <span>US, Canada &amp; Mexico residents · 18+ only</span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "inherit", textDecoration: "none" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = C.gold)}
      onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}
    >
      {children}
    </a>
  );
}
