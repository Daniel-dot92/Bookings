"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

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
        home: "Начало",
        procedures: "Процедури и Цени",
        physiotherapy: "Кинезитерапия",
        massages: "Масажи",
        conditions: "Болкови състояния",
        book: "Свободни часове",
        contacts: "Контакти",
        logo: "ДМ Физио Лого",
        logoAria: "Начало",
        nav: "Основна навигация",
        menu: "Отвори меню",
        bgAria: "Българска версия",
        bgAlt: "Български",
      };

  const base = isEn ? "https://www.dmphysi0.com/en" : "https://www.dmphysi0.com";

  return (
    <header className="tb-header" role="banner">
      <div className="tb-inner">
        <a href={base + "/"} aria-label={labels.logoAria} className="tb-logo-link">
          <Image src="/logo.png" alt={labels.logo} width={60} height={60} className="tb-logo" priority />
        </a>
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
            <li className="tb-item tb-lang-switch" aria-label="Language">
              <a className={isEn ? "tb-flag" : "tb-flag is-active"} href="/book" hrefLang="bg-BG" lang="bg" aria-label={labels.bgAria}>
                <Image src="/bulgaria-flag.webp" alt={labels.bgAlt} width={28} height={28} />
              </a>
              <a className={isEn ? "tb-flag is-active" : "tb-flag"} href="/en/book" hrefLang="en" lang="en" aria-label="English version">
                <Image src="/great-britain-flag.webp" alt="English" width={28} height={28} />
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
