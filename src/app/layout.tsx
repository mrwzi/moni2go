import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  DesktopNavigation,
  MobileNavigation,
} from "../components/shell/AppNavigation";
import { ThemeToggle } from "../components/shell/ThemeToggle";
import { AuthStatus } from "../components/auth/AuthStatus";
import { SiteFooter } from "../components/shell/SiteFooter";
import { hasSupabaseConfig } from "../lib/supabase/config";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://moni2go.vercel.app"),
  title: {
    default: "moni2go",
    template: "%s · moni2go",
  },
  description:
    "moni2go gives your money direction with private account tracking, planning, and transparent what-if analysis.",
  applicationName: "moni2go",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: "moni2go",
    title: "moni2go — Your money, with direction.",
    description:
      "See your accounts, plan your money, and explore financial decisions without connecting a bank.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-CA" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='moni2go:theme';var t=localStorage.getItem(k)||localStorage.getItem('northcents:theme')||localStorage.getItem('monevero:theme')||localStorage.getItem('finscope:theme');var v=t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');localStorage.setItem(k,v);document.documentElement.dataset.theme=v;document.documentElement.style.colorScheme=v}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <header className="site-header">
          <div className="shell header-inner">
            <Link className="wordmark" href="/" aria-label="moni2go home">
              <span className="wordmark-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32">
                  <path d="M3 25 11.5 9l4.7 7L21 5l8 20H3Z" />
                  <path d="m11 25 5.3-8.2 2.2 3.2 3.8-6.2L27 25H11Z" />
                  <path
                    className="mark-path"
                    d="M8 21c4-1 5-6 9-6 2.8 0 3.5 2.6 7 2.7"
                  />
                </svg>
              </span>
              <span>moni2go</span>
            </Link>
            <div className="header-actions">
              <DesktopNavigation />
              {hasSupabaseConfig() ? (
                <AuthStatus />
              ) : (
                <Link className="auth-link" href="/auth">
                  Sign in
                </Link>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <SiteFooter />
        <div className="mobile-navigation-spacer" aria-hidden="true" />
        <MobileNavigation />
      </body>
    </html>
  );
}
