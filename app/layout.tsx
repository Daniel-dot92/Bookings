import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/top-bar.css";
import Script from "next/script";
import Image from "next/image";
import { getSiteUrl } from "@/app/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DM PHYSIO",
  metadataBase: new URL(getSiteUrl()),
  description: "DM PHYSIO \u2013 \u043e\u043d\u043b\u0430\u0439\u043d \u0437\u0430\u043f\u0438\u0441\u0432\u0430\u043d\u0435 \u043d\u0430 \u0447\u0430\u0441",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="tb-header" role="banner">
          <div className="tb-inner">
            <a href="https://dmphysi0.com" aria-label="\u041d\u0430\u0447\u0430\u043b\u043e" className="tb-logo-link">
              <Image
                src="/logo.png"
                alt="\u0414\u041c \u0424\u0438\u0437\u0438\u043e \u041b\u043e\u0433\u043e"
                width={60}
                height={60}
                className="tb-logo"
                priority
              />
            </a>

            <button
              className="tb-burger"
              aria-controls="tb-primary-nav"
              aria-expanded="false"
              aria-label="\u041e\u0442\u0432\u043e\u0440\u0438 \u043c\u0435\u043d\u044e"
              type="button"
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <nav className="tb-nav" id="tb-primary-nav" aria-label="\u041e\u0441\u043d\u043e\u0432\u043d\u0430 \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f">
              <ul className="tb-menu">
                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com">{"\u041d\u0430\u0447\u0430\u043b\u043e"}</a>
                </li>

                <li className="tb-item tb-dropdown">
                  <a
                    className="tb-link tb-drop-toggle"
                    href="https://www.dmphysi0.com/services.html"
                  >
                    {"\u041f\u0440\u043e\u0446\u0435\u0434\u0443\u0440\u0438 \u0438 \u0426\u0435\u043d\u0438"}
                  </a>
                  <div className="tb-drop-menu">
                    <a className="tb-drop-link" href="https://dmphysi0.com/kinesitherapy.html">{"\u041a\u0438\u043d\u0435\u0437\u0438\u0442\u0435\u0440\u0430\u043f\u0438\u044f"}</a>
                    <a className="tb-drop-link" href="https://dmphysi0.com/massages.html">{"\u041c\u0430\u0441\u0430\u0436\u0438"}</a>
                  </div>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="https://dmphysi0.com/pain-conditions.html">{"\u0411\u043e\u043b\u043a\u043e\u0432\u0438 \u0441\u044a\u0441\u0442\u043e\u044f\u043d\u0438\u044f"}</a>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="/book">{"\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u0438 \u0447\u0430\u0441\u043e\u0432\u0435"}</a>
                </li>

                <li className="tb-item">
                  <a className="tb-link" href="https://www.dmphysi0.com/contacts.html">{"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u0438"}</a>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        <div className="tb-push" />

        {children}

        <Script src="/booking-topbar.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
