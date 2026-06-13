import type { Metadata, Viewport } from "next";
import { DM_Mono } from "next/font/google";
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
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Reply.",
  description: "A shared space for university students",
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
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
