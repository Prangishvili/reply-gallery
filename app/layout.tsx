import type { Metadata, Viewport } from "next";
import { DM_Mono } from "next/font/google";
import { Suspense } from "react";
import { PersistentPlayer } from "./components/PersistentPlayer";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal"],
});

export const metadata: Metadata = {
  title: "REPLY GALLERY",
  description: "Interactive Audio and Visual Experience.",
  openGraph: {
    title: "REPLY GALLERY",
    description: "Interactive Audio and Visual Experience.",
    url: "https://reply.gallery",
    siteName: "REPLY GALLERY",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "REPLY GALLERY",
    description: "Interactive Audio and Visual Experience.",
    images: ["/og-image.jpg"],
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
      className={`${dmMono.variable} h-full overflow-hidden antialiased`}
    >
      <head>
        <link rel="preload" href="/figure.glb" as="fetch" crossOrigin="anonymous" />
      </head>
      <body className="h-full overflow-hidden">
        {children}
        <Suspense><PersistentPlayer /></Suspense>
      </body>
    </html>
  );
}
