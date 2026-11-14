'use strict';
(() => {
  const directory = document.querySelector('.archive-directory');
  if (!directory) return;
  const compact = window.matchMedia('(max-width: 900px)');
  const adapt = () => { directory.open = !compact.matches; };
  adapt();
  compact.addEventListener('change', adapt);
  directory.addEventListener('click', event => {
    if (compact.matches && event.target.closest('a[href^="#"]')) directory.open = false;
  });
})();
