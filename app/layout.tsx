import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { ThemeScript } from "@/components/layout/theme-script";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { APP_CONFIG } from "@/lib/config";

const siteDescription = `Cabinet médical du ${APP_CONFIG.doctorNameFr} — ${APP_CONFIG.specialtyFr}. Gestion des patients, consultations, ordonnances et archives médicales.`;

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.clinicName,
    template: `%s · ${APP_CONFIG.clinicName}`,
  },
  description: siteDescription,
  applicationName: APP_CONFIG.clinicName,
  authors: [{ name: APP_CONFIG.doctorNameFr }],
  keywords: [
    APP_CONFIG.clinicName,
    APP_CONFIG.doctorNameFr,
    APP_CONFIG.doctorNameAr,
    APP_CONFIG.specialtyFr,
    APP_CONFIG.specialtyAr,
    "cabinet médical",
    "عيادة طبية",
    APP_CONFIG.location,
  ],
  openGraph: {
    type: "website",
    locale: "fr_MA",
    siteName: APP_CONFIG.clinicName,
    title: `${APP_CONFIG.clinicName} — ${APP_CONFIG.doctorNameFr}`,
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: `${APP_CONFIG.clinicName} — ${APP_CONFIG.doctorNameFr}`,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
