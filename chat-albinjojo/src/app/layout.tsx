import type { Metadata, Viewport } from "next";
import { Syne, Plus_Jakarta_Sans, Geist_Mono, Instrument_Serif, Anton } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-display-raw",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans-raw",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono-raw",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-accent-raw",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
});

const anton = Anton({
  variable: "--font-outline-raw",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "chat.albinjojo.me",
  description: "Ephemeral, gate-locked P2P chat rooms.",
};

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${plusJakarta.variable} ${geistMono.variable} ${instrumentSerif.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
