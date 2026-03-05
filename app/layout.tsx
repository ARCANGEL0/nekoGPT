import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { ArwesUiProvider } from "@/components/arwes-ui-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "N e k o . GPT",
  description: "Cyberpunk-styled chat interface with N e k o AI, with resources such as text completions, vision, image generation and editing.",
  icons: {
    icon: "/cat.gif",
    shortcut: "/cat.gif",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased arwes-body`}
      >
        <ArwesUiProvider>
          <div className="arwes-app-root">
            <div className="scanline" />
            <LayoutWrapper>{children}</LayoutWrapper>
          </div>
        </ArwesUiProvider>
      </body>
    </html>
  );
}
