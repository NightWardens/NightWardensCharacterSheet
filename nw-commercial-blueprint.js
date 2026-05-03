(function(){
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.querySelector('.site-nav');
  if(navToggle && siteNav){
    navToggle.addEventListener('click',()=>{
      const open = siteNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  document.querySelectorAll('[data-tabs]').forEach(shell=>{
    const tabs = shell.querySelectorAll('[data-tab]');
    const panels = shell.querySelectorAll('[data-panel]');
    tabs.forEach(tab=>{
      tab.addEventListener('click',()=>{
        const target = tab.getAttribute('data-tab');
        tabs.forEach(t=>t.classList.toggle('is-active', t === tab));
        panels.forEach(panel=>panel.classList.toggle('is-active', panel.getAttribute('data-panel') === target));
      });
    });
  });

  document.querySelectorAll('[data-accordion] .accordion-title').forEach(button=>{
    button.addEventListener('click',()=>{
      const item = button.closest('.accordion-item');
      item.classList.toggle('is-open');
    });
  });
})();
