// /app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/top-bar.css";
import Script from "next/script";
import Image from "next/image";

/* Fonts */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/* SEO */
export const metadata: Metadata = {
  title: "DM PHYSIO",
  description: "DM PHYSIO – онлайн записване на час",
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
            {/* Лого */}
            <a href="https://dmphysi0.com" aria-label="Начало" className="tb-logo-link">
              <Image
                src="/logo.png"
                alt="ДМ Физио Лого"
                width={60}
                height={60}
                className="tb-logo"
                priority
              />
            </a>

            {/* Хамбургер (SVG) */}
            <button
              className="tb-burger"
              aria-controls="tb-primary-nav"
              aria-expanded="false"
              aria-label="Отвори меню"
              type="button"
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Навигация */}
            <nav className="tb-nav" id="tb-primary-nav" aria-label="Основна навигация">
              <ul className="tb-menu">
                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com">Начало</a>
                </li>

                <li className="tb-item tb-dropdown">
                  <a
                    className="tb-link tb-drop-toggle"
                    data-dropdown="toggle"
                    href="https://dmphysi0.com/services.html"
                  >
                    Процедури и Цени
                  </a>
                  <div className="tb-drop-menu">
                    <a className="tb-drop-link" href="https://dmphysi0.com/kinesitherapy.html">Кинезитерапия</a>
                    <a className="tb-drop-link" href="https://dmphysi0.com/massages.html">Масажи</a>
                    <a className="tb-drop-link" href="https://dmphysi0.com/online-recovery.html">Онлайн Процедури</a>
                  </div>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com/pain-conditions.html">Болкови състояния</a>
                </li>

                {/* Замених "Онлайн Магазин" със "Свободни часове" */}
                <li className="tb-item">
                  <a
                    className="tb-link"
                    href="https://book.dmphysi0.com/book"
                    // Ако искаш вътрешен route: href="/book"
                  >
                    Свободни часове
                  </a>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="https://www.dmphysi0.com/contacts.html">Контакти</a>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        {/* Отместване под fixed header */}
        <div className="tb-push" />

        {/* Page content */}
        {children}

        {/* Top bar JS (в /public/topbar.js) */}
       <Script src="/topbar.js" strategy="afterInteractive" />

      
      </body>
    </html>
  );
}