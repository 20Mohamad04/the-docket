import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Docket",
  description: "Personal task and routine planner",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Was previously injected via a useEffect in app/page.tsx, which
            meant the browser didn't even start fetching it until after
            React mounted — the dominant cause of a 1-3s tofu-box FOUC on
            every icon in the app, since it's used essentially everywhere.
            Rendering it here means it's discovered and starts downloading
            as part of the initial HTML parse, same as any other stylesheet.
            Self-hosted from public/tabler/ (manually copied from
            node_modules/@tabler/icons-webfont/dist/ — see that file's own
            header comment) instead of cdn.jsdelivr.net: testing showed Edge
            Tracking Prevention interferes with the CDN in privacy mode, and
            icons are core to the UI, so a same-origin request means no
            privacy mode, ad blocker, or CDN outage can break icon
            rendering. */}
        <link rel="stylesheet" href="/tabler/tabler-icons.min.css"/>
        {/* Preloads the actual font file in parallel with the stylesheet
            above, instead of only starting once the CSS has downloaded and
            been parsed enough to discover the @font-face src — collapses
            what would otherwise be two serialized network hops into one.
            No crossOrigin — that was only needed for the CDN's cross-origin
            request; this is same-origin now. */}
        <link rel="preload" as="font" type="font/woff2"
          href="/tabler/fonts/tabler-icons.woff2?v3.19.0"/>
      </head>
      <body>{children}</body>
    </html>
  );
}