import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Cybrik Solutions | AI-Powered Business & Education Tools",
  description: "Comprehensive suite of AI-powered solutions for education and business management. IELTS preparation, CRM systems, PTE portal and more.",
  keywords: "Cybrik Solutions, IELTS Portal, CRM, PTE, AI Solutions, Education Technology, Business Management",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
