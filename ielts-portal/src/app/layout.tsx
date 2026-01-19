import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import AIChatBot from "@/components/AIChatBot";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cybrik IELTS - AI-Powered IELTS Preparation",
  description: "Know your IELTS score before test day. Get instant AI feedback on Writing and Speaking with real band score estimates.",
  keywords: "IELTS, IELTS preparation, IELTS practice, IELTS writing, IELTS speaking, AI feedback",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <SessionProviderWrapper>
          <AuthProvider>
            {children}
            <AIChatBot />
          </AuthProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

