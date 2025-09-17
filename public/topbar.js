document.addEventListener('DOMContentLoaded', () => {
    // --- JavaScript за Top Bar прозрачност при скрол ---
    const topBar = document.querySelector('.top-bar');
    const scrollThreshold = 50; 

    function adjustTopBarOpacity() {
        if (topBar) {
            const scrolled = window.scrollY;
            if (scrolled > scrollThreshold) {
                const opacity = Math.max(0.7, 1 - (scrolled - scrollThreshold) / 200);
                topBar.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`; // Използваме '0,0,0' за черен, или променете на RGB на вашия тюркоаз
            } else {
                topBar.style.backgroundColor = 'rgba(0, 0, 0, 1)'; // Пълен цвят #000000ff
            }
        }
    }

    window.addEventListener('scroll', adjustTopBarOpacity);
    adjustTopBarOpacity(); // Изпълняваме веднъж при зареждане

    // --- JavaScript за Хамбургер меню и Dropdown навигация ---
    const hamburgerToggle = document.querySelector('.hamburger-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    const dropdownToggles = document.querySelectorAll('.main-nav .dropbtn');

    if (hamburgerToggle && mainNav) {
        hamburgerToggle.addEventListener('click', function() {
            mainNav.classList.toggle('active');
            document.body.classList.toggle('no-scroll'); 
        });
    }

    // Затваряне на менюто при клик върху връзка (освен dropdown бутоните)
    mainNav.querySelectorAll('a:not(.dropbtn)').forEach(link => {
        link.addEventListener('click', () => {
            // Затваряме менюто само ако е мобилно (т.е. mainNav е активно)
            if (mainNav.classList.contains('active') && window.innerWidth <= 768) { 
                mainNav.classList.remove('active');
                document.body.classList.remove('no-scroll');
                // Затваряме и всички отворени dropdown-и
                dropdownToggles.forEach(toggle => {
                    const dropdownContent = toggle.nextElementSibling;
                    if (dropdownContent && dropdownContent.classList.contains('dropdown-content')) {
                        dropdownContent.classList.remove('active');
                    }
                });
            }
        });
    });

    // JavaScript за показване/скриване на dropdown съдържанието при клик на мобилен
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) { // Прилагаме само на мобилни
                e.preventDefault(); // Предотвратява навигацията към services.html
                const dropdownContent = this.nextElementSibling;
                if (dropdownContent && dropdownContent.classList.contains('dropdown-content')) {
                    // Затваряме всички други отворени dropdown-и, преди да отворим текущия
                    dropdownToggles.forEach(otherToggle => {
                        if (otherToggle !== toggle) {
                            const otherDropdownContent = otherToggle.nextElementSibling;
                            if (otherDropdownContent && otherDropdownContent.classList.contains('dropdown-content')) {
                                otherDropdownContent.classList.remove('active');
                            }
                        }
                    });
                    dropdownContent.classList.toggle('active'); // Добавя/премахва клас 'active'
                }
            }
        });
    });
});