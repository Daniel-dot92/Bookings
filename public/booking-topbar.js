// /public/topbar.js
(function(){
  'use strict';

  function init(){
    // синхрон с CSS @media (max-width: 768px)
    const mq = window.matchMedia('(max-width: 768px)');
    const isMobile = () => mq.matches;

    /* ---------- SELECTORS ---------- */
    const header = document.querySelector('.tb-header');
    const burger = document.querySelector('.tb-burger');
    const nav    = document.querySelector('.tb-nav');

    /* ---------- SCROLL BG ---------- */
    function applyHeaderBg(){
      if (!header) return;
      header.classList.toggle('tb--transparent', (window.scrollY || 0) > 0);
    }

    // помощник за aria-expanded
    const setExpanded = (el, v) => { try { el?.setAttribute('aria-expanded', v ? 'true' : 'false'); } catch {} };

    // затвори мобилното меню (и изчисти състояния)
    function closeMobileMenu(){
      nav?.classList.remove('tb-nav--open');
      document.body.classList.remove('tb-no-scroll');
      document.querySelectorAll('.tb-dropdown.tb-open').forEach(li => li.classList.remove('tb-open'));
      setExpanded(burger, false);
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking){
        requestAnimationFrame(() => {
          applyHeaderBg();

          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
    applyHeaderBg();

    /* ---------- MOBILE MENU ---------- */
    function toggleMobileMenu(){
      if (!nav) return;
      const open = nav.classList.toggle('tb-nav--open');
      // блокираме скрол на страницата само когато е мобилно и менюто е отворено
      document.body.classList.toggle('tb-no-scroll', open && isMobile());
      setExpanded(burger, open);
    }

    // бургерът винаги toggle-ва (без guard по ширина)
    burger?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMobileMenu();
    });

    // клик извън панела затваря (само в мобилен layout)
    document.addEventListener('click', (e) => {
      if (!isMobile() || !nav) return;
      const t = e.target;
      const inside = nav.contains(t) || burger?.contains(t);
      if (!inside && nav.classList.contains('tb-nav--open')) closeMobileMenu();
    });

    // ESC затваря (мобилен layout)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMobile() && nav?.classList.contains('tb-nav--open')) {
        closeMobileMenu();
      }
    });

    // при смяна на viewport чистим мобилното състояние
    const handleViewportChange = () => { if (!isMobile()) closeMobileMenu(); };
    window.addEventListener('resize', handleViewportChange, { passive: true });
    mq.addEventListener?.('change', handleViewportChange);

    /* ---------- DROPDOWN ---------- */
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest?.('.tb-drop-toggle');
      if (!toggle || !nav?.contains(toggle) || !isMobile()) return;
      const li = toggle.closest('.tb-dropdown');
      if (!li) return;
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.tb-dropdown.tb-open').forEach(x => { if (x !== li) x.classList.remove('tb-open'); });
      li.classList.toggle('tb-open');
    }, true);

    nav?.querySelectorAll('.tb-drop-toggle').forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        if (!isMobile()) return;
        const li = toggle.closest('.tb-dropdown');
        if (!li) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        document.querySelectorAll('.tb-dropdown.tb-open').forEach(x => { if (x !== li) x.classList.remove('tb-open'); });
        li.classList.toggle('tb-open');
      });
    });

    nav?.addEventListener('click', (e) => {
      const toggle = e.target.closest?.('.tb-drop-toggle');
      if (!toggle || !nav.contains(toggle)) return;
      const li = toggle.closest('.tb-dropdown');
      if (!li) return;
      if (isMobile()) {
        e.preventDefault();
        e.stopPropagation();
      } else if (toggle.dataset.dropdown !== 'toggle') {
        return;
      } else {
        e.preventDefault();
      }
      document.querySelectorAll('.tb-dropdown.tb-open').forEach(x => { if (x !== li) x.classList.remove('tb-open'); });
      li.classList.toggle('tb-open');
    });

    nav?.querySelectorAll('.tb-link, .tb-drop-link').forEach(link => {
      link.addEventListener('click', () => {
        if (isMobile() && link.classList.contains('tb-drop-toggle')) return;
        if (isMobile() && nav.classList.contains('tb-nav--open')) closeMobileMenu();
      });
    });

    console.log('[topbar] init');
  }

  // 🚀 важният фикс: стартирай веднага, ако DOM вече е готов
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
