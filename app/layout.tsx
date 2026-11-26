import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import Nav from "@/components/Nav";
import AccountGate from "@/components/Account";
import "./globals.css";

// Friendly rounded type: Nunito for reading, Fredoka for headings and big numbers.
const sans = Nunito({ variable: "--font-body", subsets: ["latin"] });
const display = Fredoka({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Word of the Day",
  description: "A new word every day, plus a quiz to make it stick.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-(--page-bg) font-sans text-ink transition-colors">
        <Nav />
        {/* Extra bottom room on phones for the tab bar. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 sm:pt-10 md:pb-12">
          <AccountGate>{children}</AccountGate>
        </main>
        <footer className="mx-auto hidden w-full max-w-3xl px-4 pt-4 pb-8 text-center text-xs font-semibold text-stone-400 md:block">
          A new word every morning, New York time.
        </footer>
      </body>
    </html>
  );
}
