import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "PipeBoard — Live Async Pipeline Dashboard",
  description:
    "Watch a real async job queue survive chaos: workers, exponential backoff with jitter, retries, dead-letter — streamed live over SSE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jetbrains.variable} antialiased min-h-dvh scanlines`}>
        {children}
      </body>
    </html>
  );
}
