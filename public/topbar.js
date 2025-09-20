document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const MOBILE_MAX = 768;
  const isMobile = () => window.innerWidth <= MOBILE_MAX;

  /* ---------- SELECTORS ---------- */
  const header   = document.querySelector('.tb-header');
  const burger   = document.querySelector('.tb-burger');
  const nav      = document.querySelector('.tb-nav');
  const dropToggles = document.querySelectorAll('.tb-drop-toggle');

  /* ---------- SCROLL BEHAVIOR ----------
     - при y > 0 -> става прозрачна (rgba 0.4)
     - при y === 0 -> обратно плътна
  -------------------------------------- */
  function applyHeaderBg(){
    if (!header) return;
    const y = window.scrollY || 0;
    if (y > 0) {
      header.classList.add('tb--transparent');
    } else {
      header.classList.remove('tb--transparent');
    }
  }

  // init + on scroll (с rAF)
  let ticking = false;
  function onScroll(){
    if (!ticking){
      window.requestAnimationFrame(() => {
        applyHeaderBg();
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  applyHeaderBg();

  /* ---------- MOBILE: burger toggle ---------- */
  function closeMobileMenu(){
    nav?.classList.remove('tb-nav--open');
    document.body.classList.remove('tb-no-scroll');
    // затваряме и всички отворени dropdown-и
    document.querySelectorAll('.tb-dropdown.tb-open').forEach(li => li.classList.remove('tb-open'));
    burger?.setAttribute('aria-expanded', 'false');
  }
  function toggleMobileMenu(){
    if (!nav) return;
    const open = nav.classList.toggle('tb-nav--open');
    document.body.classList.toggle('tb-no-scroll', open);
    burger?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  burger?.addEventListener('click', () => {
    if (!isMobile()) return;
    toggleMobileMenu();
  });

  // затваряне при клик извън
  document.addEventListener('click', (e) => {
    if (!isMobile() || !nav) return;
    const target = e.target;
    const inside = nav.contains(target) || burger.contains(target);
    if (!inside && nav.classList.contains('tb-nav--open')) {
      closeMobileMenu();
    }
  });

  // ESC затваря
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMobile() && nav?.classList.contains('tb-nav--open')) {
      closeMobileMenu();
    }
  });

  // при resize към десктоп чистим мобилното състояние
  window.addEventListener('resize', () => {
    if (!isMobile()) closeMobileMenu();
  });

  /* ---------- MOBILE: dropdown toggle ---------- */
/* На мобилно НЕ искаме акордеон. Позволяваме линкът да навигира. */
if (dropToggles.length){
  dropToggles.forEach(a => {
    a.addEventListener('click', (e) => {
      // ако е мобилно: не правим нищо (НЕ preventDefault), позволяваме следване на href
      if (isMobile()) return;

      // на десктоп остава поведение тип hover/click ако го искаш
      if (a.dataset.dropdown === 'toggle'){
        // по желание можеш да оставиш този блок за десктоп-клик
        // e.preventDefault();
        const li = a.closest('.tb-dropdown');
        if (!li) return;
        document.querySelectorAll('.tb-dropdown.tb-open').forEach(x => { if (x !== li) x.classList.remove('tb-open'); });
        li.classList.toggle('tb-open');
      }
    });
  });
}


  /* ---------- CLICK по линк: на мобилно затваря менюто ---------- */
  nav?.querySelectorAll('.tb-link, .tb-drop-link').forEach(link => {
    link.addEventListener('click', () => {
      if (isMobile() && nav.classList.contains('tb-nav--open')) {
        closeMobileMenu();
      }
    });
  });
});
