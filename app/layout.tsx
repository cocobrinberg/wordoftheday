import type { Metadata, Viewport } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Word of the Day",
  description: "A new word every day, plus a quiz to make it stick.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-stone-50 font-sans text-stone-900">
        <Nav />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">{children}</main>
      </body>
    </html>
  );
}
