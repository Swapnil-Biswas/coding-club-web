import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./lib/auth";
import SiteHeader from "./components/app/SiteHeader";
import AuthModal from "./components/app/AuthModal";
import Footer from "./components/Footer";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coding Club BMSIT — Code. Create. Collaborate.",
  description:
    "Coding Club BMSIT is a student-driven community of developers, designers, and tech enthusiasts. Join us for workshops, hackathons, and open-source projects.",
  keywords: [
    "coding club",
    "BMSIT",
    "programming",
    "web development",
    "hackathon",
    "open source",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <Footer />
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
