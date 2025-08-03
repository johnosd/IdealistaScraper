// popup-ui.js
document.addEventListener('DOMContentLoaded', () => {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = {
    links: document.getElementById('panel-links'),
    itens: document.getElementById('panel-itens'),
    proxy: document.getElementById('panel-proxy'),
  };

  function activate(tabKey) {
    // tabs
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tabKey));
    // panels
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('active', key === tabKey);
    });
  }

  // clique nas abas
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.tab; // "links", "itens" ou "proxy"
      activate(key);
    });
  });

  // ativa a primeira por garantia
  activate('links');
});
