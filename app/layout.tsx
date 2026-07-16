import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/top-bar.css";
import Script from "next/script";
import { getSiteUrl } from "@/app/lib/site";
import TopBar from "@/app/components/TopBar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const hotjarId = Number.isFinite(Number(process.env.NEXT_PUBLIC_HOTJAR_ID))
  ? Number(process.env.NEXT_PUBLIC_HOTJAR_ID)
  : 6534654;

export const metadata: Metadata = {
  title: "DM PHYSIO",
  metadataBase: new URL(getSiteUrl()),
  description: "DM PHYSIO \u2013 \u043e\u043d\u043b\u0430\u0439\u043d \u0437\u0430\u043f\u0438\u0441\u0432\u0430\u043d\u0435 \u043d\u0430 \u0447\u0430\u0441",
  icons: {
    icon: "/favicon-original.ico?v=20260717",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TopBar />

        <div className="tb-push" />

        {children}

        <Script id="hotjar-consent" strategy="afterInteractive">{`
          (function () {
            var consentKey = 'dm_cookie_consent_v1';

            function hasAnalyticsConsent() {
              try {
                var consent = JSON.parse(localStorage.getItem(consentKey) || 'null');
                return Boolean(consent && consent.analytics === true);
              } catch (_) {
                return false;
              }
            }

            function respectsDoNotTrack() {
              try {
                return navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
              } catch (_) {
                return false;
              }
            }

            function loadHotjar() {
              if (window.__dmHotjarLoaded || !hasAnalyticsConsent() || respectsDoNotTrack()) return;
              window.__dmHotjarLoaded = true;

              (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:${hotjarId},hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            }

            loadHotjar();
            window.addEventListener('dm-cookie-consent-change', function (event) {
              if (event.detail && event.detail.analytics === true) loadHotjar();
            });
          })();
        `}</Script>
        <Script src="/booking-topbar.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
