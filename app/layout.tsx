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
      <body>{children}</body>
    </html>
  );
}