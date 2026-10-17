import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./lib/auth";
import { RecruitmentProvider } from "./lib/recruitment";
import SiteHeader from "./components/app/SiteHeader";
import AuthModal from "./components/app/AuthModal";
import RecruitmentBanner from "./components/app/RecruitmentBanner";
import Footer from "./components/Footer";
import ConsoleEasterEgg from "./components/app/ConsoleEasterEgg";

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
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
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
          <RecruitmentProvider>
            <SiteHeader />
            <RecruitmentBanner />
            {children}
            <Footer />
            <AuthModal />
            <ConsoleEasterEgg />
          </RecruitmentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
