import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fur Fur & POS",
  description: "ระบบคิดเงินและบริหารร้าน Fur Fur & (เฟอ เฟอ แอนด์)",
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fur Fur & POS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=furfur1" />
        <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png?v=furfur1" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=furfur1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png?v=furfur1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="bg-stone-100 text-stone-800" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
