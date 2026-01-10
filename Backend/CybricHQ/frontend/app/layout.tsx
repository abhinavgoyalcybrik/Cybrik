import "./globals.css";
import React from 'react'
import { UserProvider } from "@/context/UserContext";
import { TenantProvider } from "@/context/TenantContext";

export const metadata = {
  title: 'CybrikHQ',
  description: 'CybrikHQ Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <TenantProvider>
            {children}
          </TenantProvider>
        </UserProvider>
      </body>
    </html>
  )
}
