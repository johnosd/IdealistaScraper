function extractLinks(doc = document) {
  const container = doc.querySelector('nav.locations-list');
  if (!container) return [];

  const base = location.origin;
  const seen = new Set();
  const rows = [];

  const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const abs = (href) => { try { return new URL(href, base).href; } catch { return null; } };

  container.querySelectorAll('ul.locations-list__links').forEach((col) => {
    const regionA = col.querySelector('a > h3.region-title')?.parentElement;
    const regiao = norm(regionA?.textContent);

    col.querySelectorAll(':scope > li').forEach((li) => {
      const subA = li.querySelector(':scope > a.subregion');
      const contagemEl = li.querySelector(':scope > p');
      const contagem = norm(contagemEl?.textContent);
      const subregiao = norm(subA?.textContent);

      if (subA) {
        const url = abs(subA.getAttribute('href'));
        if (url && !seen.has(url)) {
          seen.add(url);
          rows.push({
            "Região": regiao || null,
            "Sub-região": subregiao || null,
            "Município": null,
            "Tipo": "Sub-região",
            "Texto": subregiao || null,
            "URL": url,
            "Contagem": contagem || null
          });
        }
      }

      li.querySelectorAll(':scope ul.locations-list__municipalities > li > a').forEach((munA) => {
        const municipio = norm(munA.textContent);
        const url = abs(munA.getAttribute('href'));
        if (url && !seen.has(url)) {
          seen.add(url);
          rows.push({
            "Região": regiao || null,
            "Sub-região": subregiao || null,
            "Município": municipio || null,
            "Tipo": "Município",
            "Texto": municipio || null,
            "URL": url,
            "Contagem": null
          });
        }
      });
    });

    if (regionA) {
      const url = abs(regionA.getAttribute('href'));
      if (url && !seen.has(url)) {
        seen.add(url);
        rows.push({
          "Região": regiao || null,
          "Sub-região": null,
          "Município": null,
          "Tipo": "Região",
          "Texto": regiao || null,
          "URL": url,
          "Contagem": null
        });
      }
    }
  });

  return rows;
}
