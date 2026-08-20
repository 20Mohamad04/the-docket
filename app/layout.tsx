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
            as part of the initial HTML parse, same as any other stylesheet. */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"/>
        {/* Preloads the actual font file in parallel with the stylesheet
            above, instead of only starting once the CSS has downloaded and
            been parsed enough to discover the @font-face src — collapses
            what would otherwise be two serialized network hops into one. */}
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/fonts/tabler-icons.woff2?v3.19.0"/>
      </head>
      <body>{children}</body>
    </html>
  );
}