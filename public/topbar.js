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

          // ✅ ДОПЪЛНЕНИЕ: ако сме в мобилен layout и менюто е отворено – скролът го затваря
          if (isMobile() && nav?.classList.contains('tb-nav--open')) {
            closeMobileMenu();
          }

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

    // ✅ ДОПЪЛНЕНИЕ: скрол-жестове затварят менюто (wheel / touchmove)
    const maybeCloseOnScrollGesture = () => {
      if (isMobile() && nav?.classList.contains('tb-nav--open')) closeMobileMenu();
    };
    window.addEventListener('wheel', maybeCloseOnScrollGesture, { passive: true });
    window.addEventListener('touchmove', maybeCloseOnScrollGesture, { passive: true });

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
