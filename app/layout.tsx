import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { AppWalletProvider } from "@/components/wallet/WalletProvider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GlassJar — Cookie Chain Trading Terminal",
  description:
    "Connect your wallet, execute real swaps on Cookie Chain, and track your portfolio — all in one place.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${outfit.className} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${outfit.className} min-h-full flex flex-col bg-bg text-text-primary font-sans`}>
        <AppWalletProvider>
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}
