"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISSAL_KEY = "moni2go:disclaimer-dismissed:v1";
const LEGACY_DISMISSAL_KEY = "northcents:disclaimer-dismissed:v1";

export function SiteFooter() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      setVisible(
        localStorage.getItem(DISMISSAL_KEY) !== "true" &&
          localStorage.getItem(LEGACY_DISMISSAL_KEY) !== "true",
      );
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <p>
          Estimates are based on your assumptions. moni2go provides analysis,
          not financial advice.
        </p>
        <nav aria-label="Information">
          <Link href="/methodology">Methodology</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <button
          className="footer-dismiss"
          type="button"
          aria-label="Dismiss disclaimer"
          title="Hide this message"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSAL_KEY, "true");
            } catch {
              // The message can still be hidden for the current page.
            }
            setVisible(false);
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </footer>
  );
}
