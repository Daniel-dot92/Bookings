// /public/topbar.js
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  console.log('[topbar] loaded');

  /* ---------- CONFIG ---------- */
  const MOBILE_MAX = 768;
  const isMobile = () => window.innerWidth <= MOBILE_MAX;

  /* ---------- SELECTORS ---------- */
  const header = document.querySelector('.tb-header');
  const burger = document.querySelector('.tb-burger');
  const nav    = document.querySelector('.tb-nav');
  const dropToggles = document.querySelectorAll('.tb-drop-toggle');

  /* ---------- SCROLL BG (solid at top, transparent on scroll) ---------- */
  function applyHeaderBg(){
    if (!header) return;
    const y = window.scrollY || 0;
    header.classList.toggle('tb--transparent', y > 0);
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking){
      requestAnimationFrame(() => { applyHeaderBg(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  applyHeaderBg();

  /* ---------- MOBILE MENU TOGGLE ---------- */
  function setExpanded(el, val){
    try { el?.setAttribute('aria-expanded', val ? 'true' : 'false'); } catch {}
  }
  function closeMobileMenu(){
    nav?.classList.remove('tb-nav--open');
    document.body.classList.remove('tb-no-scroll');
    setExpanded(burger, false);
    // затваряме и всички отворени dropdown-и
    document.querySelectorAll('.tb-dropdown.tb-open')
      .forEach(li => li.classList.remove('tb-open'));
  }
  function toggleMobileMenu(){
    if (!nav) return;
    const open = nav.classList.toggle('tb-nav--open');
    document.body.classList.toggle('tb-no-scroll', open);
    setExpanded(burger, open);
  }

  // ВАЖНО: винаги toggle-ва (без if (!isMobile()) return)
  burger?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMobileMenu();
  });

  // клик извън навигацията затваря (само на мобилно)
  document.addEventListener('click', (e) => {
    if (!isMobile() || !nav) return;
    const t = e.target;
    const inside = nav.contains(t) || burger?.contains(t);
    if (!inside && nav.classList.contains('tb-nav--open')) {
      closeMobileMenu();
    }
  });

  // ESC затваря (само на мобилно)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMobile() && nav?.classList.contains('tb-nav--open')) {
      closeMobileMenu();
    }
  });

  // при resize към десктоп чистим мобилното състояние
  window.addEventListener('resize', () => {
    if (!isMobile()) closeMobileMenu();
  });

  /* ---------- DROPDOWN: мобилен акордеон ---------- */
  if (dropToggles.length){
    dropToggles.forEach(a => {
      a.addEventListener('click', (e) => {
        const li = a.closest('.tb-dropdown');
        if (!li) return;

        if (isMobile()){
          // На мобилно: НЕ навигираме; отваряме подменюто
          e.preventDefault();
          // (по избор) затваряй други отворени:
          document.querySelectorAll('.tb-dropdown.tb-open')
            .forEach(x => { if (x !== li) x.classList.remove('tb-open'); });
          li.classList.toggle('tb-open');
          // ако менюто беше затворено (рядко при race), отворѝ го
          if (!nav.classList.contains('tb-nav--open')) toggleMobileMenu();
          return;
        }

        // На десктоп може да остане само :hover от CSS.
        // Ако искаш клик и на десктоп – разкоментирай:
        // e.preventDefault();
        // document.querySelectorAll('.tb-dropdown.tb-open')
        //   .forEach(x => { if (x !== li) x.classList.remove('tb-open'); });
        // li.classList.toggle('tb-open');
      });
    });
  }

  /* ---------- Клик по линк: на мобилно затваря панела ---------- */
  nav?.querySelectorAll('.tb-link, .tb-drop-link').forEach(link => {
    link.addEventListener('click', () => {
      if (isMobile() && nav.classList.contains('tb-nav--open')) {
        closeMobileMenu();
      }
    });
  });
});
