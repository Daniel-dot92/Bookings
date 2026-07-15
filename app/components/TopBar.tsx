"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type HeaderLabels = {
  home: string;
  procedures: string;
  physiotherapy: string;
  massages: string;
  conditions: string;
  contacts: string;
  search: string;
  searchSite: string;
  searchPlaceholder: string;
  closeSearch: string;
  book: string;
  logo: string;
  logoAria: string;
  nav: string;
  menu: string;
  bgAria: string;
  bgAlt: string;
};

type SearchPage = {
  title?: string;
  url?: string;
  excerpt?: string;
  tags?: string | string[];
  text?: string;
  locale?: "bg" | "en";
  type?: string;
  thumbnail?: string;
  images?: string[];
};

const MAIN_SITE_URL = "https://www.dmphysi0.com";
const SEARCH_INDEX_URL = "/api/search-index";
const HIDDEN_SEARCH_PAGES = /^\/(?:en\/)?(?:uprazhnenia|biblioteka-uprazhnenia|simptomi|diagnozi|zoni|celi|sesii|programi|trenirovki|individualna-programa|uprazhnenie|trenirovka|programa)\.html/;

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("bg-BG")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/шишове/g, "шипове");
}

function getSearchTokens(query: string, isEn: boolean) {
  const stopWords = new Set(
    isEn
      ? ["a", "an", "the", "and", "or", "for", "of", "to", "in", "with", "on"]
      : ["и", "или", "на", "в", "с", "за", "от", "до", "при", "по", "към"]
  );
  return normalizeSearchText(query)
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function scoreSearchPage(page: SearchPage, query: string, isEn: boolean) {
  const normalizedQuery = normalizeSearchText(query).trim();
  const tokens = getSearchTokens(query, isEn);
  if (!normalizedQuery || (!tokens.length && normalizedQuery.length < 3)) return 0;

  const title = normalizeSearchText(page.title);
  const excerpt = normalizeSearchText(page.excerpt);
  const tags = normalizeSearchText(Array.isArray(page.tags) ? page.tags.join(" ") : page.tags);
  const body = normalizeSearchText(page.text);
  const haystack = `${title} ${excerpt} ${tags} ${body}`;
  const allTokensMatch = tokens.length
    ? tokens.every((token) => haystack.includes(token))
    : haystack.includes(normalizedQuery);
  const anyTokenMatch = tokens.some((token) => haystack.includes(token));
  const exactMatch = [title, excerpt, tags, body].some((value) =>
    value.includes(normalizedQuery)
  );

  if (!exactMatch && !allTokensMatch && !anyTokenMatch) return 0;

  let score = page.locale === (isEn ? "en" : "bg") ? 8 : 0;
  if (title.includes(normalizedQuery)) score += 240;
  if (excerpt.includes(normalizedQuery)) score += 90;
  if (tags.includes(normalizedQuery)) score += 75;
  if (body.includes(normalizedQuery)) score += 45;
  if (allTokensMatch) score += 70;
  for (const token of tokens) {
    if (title.includes(token)) score += 42;
    if (tags.includes(token)) score += 24;
    if (excerpt.includes(token)) score += 18;
    if (body.includes(token)) score += 4;
  }
  return !allTokensMatch && tokens.length > 1 ? Math.floor(score * 0.32) : score;
}

function toMainSiteUrl(value?: string) {
  if (!value) return MAIN_SITE_URL;
  if (/^https?:\/\//i.test(value)) return value;
  return `${MAIN_SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

function getSearchPageTitle(value?: string) {
  return String(value || "")
    .replace(/\s*\|\s*(?:ДМ\s*Физио|DM Physio)(?:\s+София)?\s*$/i, "")
    .replace(/\s*(?:-|–)\s*(?:ДМ\s*Физио|DM Physio)(?:\s+София)?\s*$/i, "")
    .trim();
}

function getSearchPageType(type: string | undefined, isEn: boolean) {
  const bg: Record<string, string> = {
    condition: "Ръководство",
    procedure: "Процедура",
    booking: "Свободни часове",
    contact: "Контакт",
    page: "Страница",
    video: "Видео",
  };
  const en: Record<string, string> = {
    condition: "Guide",
    procedure: "Service",
    booking: "Booking",
    contact: "Contact",
    page: "Page",
    video: "Video",
  };
  return (isEn ? en : bg)[type || "page"] || type || (isEn ? "Page" : "Страница");
}

function LanguageSwitch({
  isEn,
  labels,
  bgHref,
  enHref,
  className = "tb-lang-switch",
}: {
  isEn: boolean;
  labels: HeaderLabels;
  bgHref: string;
  enHref: string;
  className?: string;
}) {
  return (
    <div className={className} aria-label="Language" tabIndex={0}>
      <button
        className="tb-lang-current"
        type="button"
        aria-label={isEn ? "Change language" : "Смени езика"}
      >
        <span className="tb-lang-current__flag">
          <Image
            src={isEn ? "/great-britain-flag.webp" : "/bulgaria-flag.webp"}
            alt={isEn ? "English" : labels.bgAlt}
            width={30}
            height={20}
          />
        </span>
        <span>{isEn ? "EN" : "BG"}</span>
        <b aria-hidden="true">▾</b>
      </button>

      <div className="tb-lang-menu">
        <Link
          className={isEn ? "tb-lang-option" : "tb-lang-option is-active"}
          href={bgHref}
          hrefLang="bg-BG"
          lang="bg"
          aria-label={labels.bgAria}
        >
          <Image src="/bulgaria-flag.webp" alt={labels.bgAlt} width={30} height={20} />
          <span>BG</span>
        </Link>
        <Link
          className={isEn ? "tb-lang-option is-active" : "tb-lang-option"}
          href={enHref}
          hrefLang="en"
          lang="en"
          aria-label="English version"
        >
          <Image src="/great-britain-flag.webp" alt="English" width={30} height={20} />
          <span>EN</span>
        </Link>
      </div>
    </div>
  );
}

export default function TopBar() {
  const pathname = usePathname();
  const isEn = pathname.startsWith("/en");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchPages, setSearchPages] = React.useState<SearchPage[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState(false);
  const [searchSubmitted, setSearchSubmitted] = React.useState(false);
  const deferredSearchQuery = React.useDeferredValue(searchQuery.trim());

  React.useEffect(() => {
    document.documentElement.lang = isEn ? "en" : "bg";
  }, [isEn]);

  React.useEffect(() => {
    if (!searchOpen || searchPages.length > 0) return;

    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(false);
    fetch(SEARCH_INDEX_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Search index failed");
        return response.json() as Promise<{ pages?: SearchPage[] }>;
      })
      .then((payload) => {
        const seenUrls = new Set<string>();
        const pages = (payload.pages || []).filter((page) => {
          const pageUrl = page.url || "";
          if (!pageUrl || seenUrls.has(pageUrl) || HIDDEN_SEARCH_PAGES.test(pageUrl)) {
            return false;
          }
          seenUrls.add(pageUrl);
          return true;
        });
        setSearchPages(pages);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError(true);
      })
      .finally(() => setSearchLoading(false));

    return () => controller.abort();
  }, [searchOpen, searchPages.length]);

  React.useEffect(() => {
    if (!searchOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchOpen]);

  const labels: HeaderLabels = isEn
    ? {
        home: "Home",
        procedures: "Procedures",
        physiotherapy: "Physiotherapy",
        massages: "Massage",
        conditions: "Pain conditions",
        contacts: "Contacts",
        search: "Search",
        searchSite: "Search the site",
        searchPlaceholder: "Search the site...",
        closeSearch: "Close",
        book: "Book",
        logo: "DM Physio logo",
        logoAria: "Home",
        nav: "Main navigation",
        menu: "Open menu",
        bgAria: "Bulgarian version",
        bgAlt: "Bulgarian",
      }
    : {
        home: "Начало",
        procedures: "Процедури",
        physiotherapy: "Кинезитерапия",
        massages: "Масажи",
        conditions: "Болкови състояния",
        contacts: "Контакти",
        search: "Търси",
        searchSite: "Търси в сайта",
        searchPlaceholder: "Търси в сайта...",
        closeSearch: "Затвори",
        book: "Свободни часове",
        logo: "DM Physio лого",
        logoAria: "Начало",
        nav: "Основна навигация",
        menu: "Отвори меню",
        bgAria: "Българска версия",
        bgAlt: "Български",
      };

  const base = isEn ? "https://www.dmphysi0.com/en" : "https://www.dmphysi0.com";
  const bookingSuffix = pathname.replace(/^\/en/, "").replace(/^\/book/, "");
  const bgBookingHref = `/book${bookingSuffix}`;
  const enBookingHref = `/en/book${bookingSuffix}`;
  const searchCopy = isEn
    ? {
        suggestions: "Suggestions",
        results: "Search results",
        empty: "No results found.",
        loading: "Loading search...",
        error: "Search is temporarily unavailable.",
        page: "Page",
      }
    : {
        suggestions: "Предложения",
        results: "Резултати от търсенето",
        empty: "Няма намерени резултати.",
        loading: "Зареждане на търсачката...",
        error: "Търсачката временно не е достъпна.",
        page: "Страница",
      };
  const searchMatches = deferredSearchQuery
    ? searchPages
        .map((page) => ({ page, score: scoreSearchPage(page, deferredSearchQuery, isEn) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, searchSubmitted ? 24 : 6)
        .map((entry) => entry.page)
    : [];

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchSubmitted(true);
  }

  const searchIcon = (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" focusable="false">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return (
    <header className="tb-header" role="banner">
      <div className="tb-inner">
        <a href={`${base}/`} aria-label={labels.logoAria} className="tb-logo-link">
          <Image src="/logo.png" alt={labels.logo} width={60} height={60} className="tb-logo" priority />
        </a>

        <button
          className="dm-search-trigger dm-search-trigger--mobile"
          type="button"
          aria-expanded={searchOpen}
          aria-controls="dm-site-search-panel"
          aria-label={labels.search}
          onClick={() => setSearchOpen((open) => !open)}
        >
          {searchIcon}
          <span>{labels.search}</span>
        </button>

        <LanguageSwitch
          isEn={isEn}
          labels={labels}
          bgHref={bgBookingHref}
          enHref={enBookingHref}
          className="tb-header-lang tb-header-lang--mobile"
        />

        <button
          className="tb-burger"
          aria-controls="tb-primary-nav"
          aria-expanded="false"
          aria-label={labels.menu}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <nav className="tb-nav" id="tb-primary-nav" aria-label={labels.nav}>
          <ul className="tb-menu">
            <li className="tb-item"><a className="tb-link" href={`${base}/`}>{labels.home}</a></li>
            <li className="tb-item"><a className="tb-link" href={`${base}/services.html`}>{labels.procedures}</a></li>
            <li className="tb-item"><a className="tb-link" href={`${base}/pain-conditions.html`}>{labels.conditions}</a></li>
            <li className="tb-item"><a className="tb-link" href={`${base}/contacts.html`}>{labels.contacts}</a></li>
            <li className="tb-item tb-search-item">
              <button
                className="dm-search-trigger dm-search-trigger--menu"
                type="button"
                aria-expanded={searchOpen}
                aria-controls="dm-site-search-panel"
                aria-label={labels.search}
                onClick={() => setSearchOpen((open) => !open)}
              >
                {searchIcon}
                <span>{labels.search}</span>
              </button>
            </li>
            <li className="tb-item tb-lang-item">
              <LanguageSwitch
                isEn={isEn}
                labels={labels}
                bgHref={bgBookingHref}
                enHref={enBookingHref}
              />
            </li>
            <li className="tb-item tb-book-item">
              <Link className="tb-link tb-book-link" href={isEn ? "/en/book" : "/book"}>
                {labels.book}
              </Link>
            </li>
          </ul>
        </nav>

        {searchOpen ? (
          <section id="dm-site-search-panel" className="dm-site-search" aria-label={labels.searchSite}>
            <form role="search" onSubmit={submitSearch}>
              <label className="dm-site-search__label" htmlFor="dm-site-search-input">
                {labels.searchSite}
              </label>
              <div className="dm-site-search__row">
                <input
                  id="dm-site-search-input"
                  type="search"
                  autoComplete="off"
                  placeholder={labels.searchPlaceholder}
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchSubmitted(false);
                  }}
                  autoFocus
                />
                <button type="submit">{labels.search}</button>
                <button
                  className="dm-site-search__close"
                  type="button"
                  aria-label={labels.closeSearch}
                  onClick={() => setSearchOpen(false)}
                >
                  ×
                </button>
              </div>
            </form>
            <p className="dm-site-search__status" aria-live="polite">
              {searchLoading
                ? searchCopy.loading
                : searchError
                  ? searchCopy.error
                  : deferredSearchQuery && searchMatches.length === 0
                    ? searchCopy.empty
                    : ""}
            </p>
            {searchMatches.length > 0 ? (
              <div className="dm-site-search__results" aria-label={searchSubmitted ? searchCopy.results : searchCopy.suggestions}>
                {searchMatches.map((page) => {
                  const imageUrl = page.thumbnail || page.images?.[0];
                  return (
                    <a
                      className="dm-search-result"
                      href={toMainSiteUrl(page.url)}
                      key={page.url}
                      onClick={() => setSearchOpen(false)}
                    >
                      {imageUrl ? (
                        <img src={toMainSiteUrl(imageUrl)} alt="" loading="lazy" />
                      ) : null}
                      <span className="dm-search-result__body">
                        <strong>{getSearchPageTitle(page.title)}</strong>
                        {page.excerpt ? <small>{page.excerpt}</small> : null}
                      </span>
                      <span className="dm-search-result__type">
                        {getSearchPageType(page.type, isEn)}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </header>
  );
}
