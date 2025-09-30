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
    const dropToggles = document.querySelectorAll('.tb-drop-toggle');

    /* ---------- SCROLL BG ---------- */
    function applyHeaderBg(){
      if (!header) return;
      header.classList.toggle('tb--transparent', (window.scrollY || 0) > 0);
    }
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking){
        requestAnimationFrame(() => { applyHeaderBg(); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
    applyHeaderBg();

    /* ---------- MOBILE MENU ---------- */
    const setExpanded = (el, v) => { try { el?.setAttribute('aria-expanded', v ? 'true' : 'false'); } catch {} };

    function closeMobileMenu(){
      nav?.classList.remove('tb-nav--open');
      document.body.classList.remove('tb-no-scroll');
      document.querySelectorAll('.tb-dropdown.tb-open').forEach(li => li.classList.remove('tb-open'));
      setExpanded(burger, false);
    }

    function toggleMobileMenu(){
      if (!nav) return;
      const open = nav.classList.toggle('tb-nav--open');
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
    // на мобилно: линковете навигират; на десктоп: hover (CSS) + optional click-toggle
    dropToggles.forEach(a => {
      a.addEventListener('click', (e) => {
        if (isMobile()) return; // мобилно → следва href
        if (a.dataset.dropdown === 'toggle'){
          e.preventDefault();
          const li = a.closest('.tb-dropdown');
          if (!li) return;
          document.querySelectorAll('.tb-dropdown.tb-open').forEach(x => { if (x !== li) x.classList.remove('tb-open'); });
          li.classList.toggle('tb-open');
        }
      });
    });

    // клик по линк → затваря панела в мобилен layout
    nav?.querySelectorAll('.tb-link, .tb-drop-link').forEach(link => {
      link.addEventListener('click', () => {
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