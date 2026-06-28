import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StackDocs",
    template: "%s | StackDocs",
  },
  description: "Documentation for the Stack commerce platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Navbar />
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
