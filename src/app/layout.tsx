import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/newsreader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lab Asset Management System | MAHE",
  description: "Asset Management System for Manipal Academy of Higher Education Engineering Colleges",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
