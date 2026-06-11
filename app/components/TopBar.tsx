"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

function LanguageSwitch({ isEn, labels, className = "tb-lang-switch" }: {
  isEn: boolean;
  labels: { bgAria: string; bgAlt: string };
  className?: string;
}) {
  return (
    <div className={className} aria-label="Language">
      <a className={isEn ? "tb-flag" : "tb-flag is-active"} href="/book" hrefLang="bg-BG" lang="bg" aria-label={labels.bgAria}>
        <Image src="/bulgaria-flag.webp" alt={labels.bgAlt} width={28} height={28} />
      </a>
      <a className={isEn ? "tb-flag is-active" : "tb-flag"} href="/en/book" hrefLang="en" lang="en" aria-label="English version">
        <Image src="/great-britain-flag.webp" alt="English" width={28} height={28} />
      </a>
    </div>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const isEn = pathname.startsWith("/en");

  React.useEffect(() => {
    document.documentElement.lang = isEn ? "en" : "bg";
  }, [isEn]);

  const labels = isEn
    ? {
        home: "Home",
        procedures: "Procedures",
        physiotherapy: "Physiotherapy",
        massages: "Massage",
        conditions: "Pain conditions",
        book: "Book",
        contacts: "Contacts",
        logo: "DM Physio logo",
        logoAria: "Home",
        nav: "Main navigation",
        menu: "Open menu",
        bgAria: "Bulgarian version",
        bgAlt: "Bulgarian",
      }
    : {
        home: "\u041d\u0430\u0447\u0430\u043b\u043e",
        procedures: "\u041f\u0440\u043e\u0446\u0435\u0434\u0443\u0440\u0438 \u0438 \u0426\u0435\u043d\u0438",
        physiotherapy: "\u041a\u0438\u043d\u0435\u0437\u0438\u0442\u0435\u0440\u0430\u043f\u0438\u044f",
        massages: "\u041c\u0430\u0441\u0430\u0436\u0438",
        conditions: "\u0411\u043e\u043b\u043a\u043e\u0432\u0438 \u0441\u044a\u0441\u0442\u043e\u044f\u043d\u0438\u044f",
        book: "\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u0438 \u0447\u0430\u0441\u043e\u0432\u0435",
        contacts: "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u0438",
        logo: "\u0414\u041c \u0424\u0438\u0437\u0438\u043e \u041b\u043e\u0433\u043e",
        logoAria: "\u041d\u0430\u0447\u0430\u043b\u043e",
        nav: "\u041e\u0441\u043d\u043e\u0432\u043d\u0430 \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f",
        menu: "\u041e\u0442\u0432\u043e\u0440\u0438 \u043c\u0435\u043d\u044e",
        bgAria: "\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0430 \u0432\u0435\u0440\u0441\u0438\u044f",
        bgAlt: "\u0411\u044a\u043b\u0433\u0430\u0440\u0441\u043a\u0438",
      };

  const base = isEn ? "https://www.dmphysi0.com/en" : "https://www.dmphysi0.com";

  return (
    <header className="tb-header" role="banner">
      <div className="tb-inner">
        <a href={base + "/"} aria-label={labels.logoAria} className="tb-logo-link">
          <Image src="/logo.png" alt={labels.logo} width={60} height={60} className="tb-logo" priority />
        </a>
        <LanguageSwitch isEn={isEn} labels={labels} className="tb-header-lang" />
        <button className="tb-burger" aria-controls="tb-primary-nav" aria-expanded="false" aria-label={labels.menu} type="button">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <nav className="tb-nav" id="tb-primary-nav" aria-label={labels.nav}>
          <ul className="tb-menu">
            <li className="tb-item"><a className="tb-link" href={base + "/"}>{labels.home}</a></li>
            <li className="tb-item tb-dropdown">
              <a className="tb-link tb-drop-toggle" href={base + "/services.html"}>{labels.procedures}</a>
              <div className="tb-drop-menu">
                <a className="tb-drop-link" href={base + "/kinesitherapy.html"}>{labels.physiotherapy}</a>
                <a className="tb-drop-link" href={base + "/massages.html"}>{labels.massages}</a>
              </div>
            </li>
            <li className="tb-item"><a className="tb-link" href={base + "/pain-conditions.html"}>{labels.conditions}</a></li>
            <li className="tb-item"><a className="tb-link tb-book-link" href={isEn ? "/en/book" : "/book"}>{labels.book}</a></li>
            <li className="tb-item"><a className="tb-link" href={base + "/contacts.html"}>{labels.contacts}</a></li>
            <li className="tb-item"><LanguageSwitch isEn={isEn} labels={labels} /></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
