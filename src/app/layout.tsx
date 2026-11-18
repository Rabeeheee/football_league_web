import type { Metadata } from "next";
import Image from "next/image";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";
import { ORGANIZER } from "@/lib/organizer";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Culvert Football League · Team Culvert",
  description:
    "Home-ground football league organised by Team Culvert arts & sports club, Padoor — teams, fixtures, and points table",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
  themeColor: "#0b1f14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <Nav />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-white/10 px-3 py-5 sm:py-6">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-3">
                <Image
                  src={ORGANIZER.logoSrc}
                  alt={ORGANIZER.fullName}
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
                <div className="text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    Organised by
                  </p>
                  <p className="text-sm font-semibold text-white/70">
                    {ORGANIZER.fullName}
                  </p>
                  <p className="text-[11px] text-white/40">{ORGANIZER.place}</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-white/30 sm:text-xs">
                Culvert Football League · Entry fee per person · Payment offline
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
