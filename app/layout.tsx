import type { Metadata } from "next";
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

/* Viewport (важно за мобилните media queries) */
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Top Bar */}
        <header className="tb-header">
          <div className="tb-inner">
            <a href="https://dmphysi0.com" aria-label="Начало">
              <Image
                src="/logo.png"
                alt="ДМ Физио Лого"
                width={50}
                height={50}
                className="tb-logo"
                priority
              />
            </a>

            <button className="tb-burger" aria-label="Toggle navigation" aria-expanded="false">
              <span style={{ fontSize: 28, lineHeight: 1 }}>☰</span>
            </button>

            <nav className="tb-nav" aria-label="Основна навигация">
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
                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com/shop.html">Онлайн Магазин</a>
                </li>
                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com/contact.html">Контакти</a>
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
