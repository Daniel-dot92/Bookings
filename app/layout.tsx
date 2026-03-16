import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/top-bar.css";
import Script from "next/script";
import Image from "next/image";
import { getSiteUrl } from "@/app/lib/site";

/* Fonts */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/* SEO */
export const metadata: Metadata = {
  title: "DM PHYSIO",
  metadataBase: new URL(getSiteUrl()),
  description: "DM PHYSIO вЂ“ РѕРЅР»Р°Р№РЅ Р·Р°РїРёСЃРІР°РЅРµ РЅР° С‡Р°СЃ",
};

/* Viewport */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ======= Top bar ======= */}
        <header className="tb-header" role="banner">
          <div className="tb-inner">
            {/* Р›РѕРіРѕ */}
            <a href="https://dmphysi0.com" aria-label="РќР°С‡Р°Р»Рѕ" className="tb-logo-link">
              <Image
                src="/logo.png"
                alt="Р”Рњ Р¤РёР·РёРѕ Р›РѕРіРѕ"
                width={60}
                height={60}
                className="tb-logo"
                priority
              />
            </a>

            {/* РҐР°РјР±СѓСЂРіРµСЂ (SVG) */}
            <button
              className="tb-burger"
              aria-controls="tb-primary-nav"
              aria-expanded="false"
              aria-label="РћС‚РІРѕСЂРё РјРµРЅСЋ"
              type="button"
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* РќР°РІРёРіР°С†РёСЏ */}
            <nav className="tb-nav" id="tb-primary-nav" aria-label="РћСЃРЅРѕРІРЅР° РЅР°РІРёРіР°С†РёСЏ">
              <ul className="tb-menu">
                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com">РќР°С‡Р°Р»Рѕ</a>
                </li>

                <li className="tb-item tb-dropdown">
                  <a
                    className="tb-link tb-drop-toggle"
                    href="https://www.dmphysi0.com/services.html"
                  >
                    РџСЂРѕС†РµРґСѓСЂРё Рё Р¦РµРЅРё
                  </a>
                  <div className="tb-drop-menu">
                    <a className="tb-drop-link" href="https://dmphysi0.com/kinesitherapy.html">РљРёРЅРµР·РёС‚РµСЂР°РїРёСЏ</a>
                    <a className="tb-drop-link" href="https://dmphysi0.com/massages.html">РњР°СЃР°Р¶Рё</a>
                  </div>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com/pain-conditions.html">Р‘РѕР»РєРѕРІРё СЃСЉСЃС‚РѕСЏРЅРёСЏ</a>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="/book">РЎРІРѕР±РѕРґРЅРё С‡Р°СЃРѕРІРµ</a>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="https://www.dmphysi0.com/contacts.html">РљРѕРЅС‚Р°РєС‚Рё</a>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        {/* РћС‚РјРµСЃС‚РІР°РЅРµ РїРѕРґ fixed header */}
        <div className="tb-push" />

        {/* Page content */}
        {children}

        {/* Top bar JS (РІ /public/topbar.js) */}
        <Script src="/booking-topbar.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
