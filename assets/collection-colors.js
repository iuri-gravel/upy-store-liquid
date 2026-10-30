(() => {
  const colorParams = ["cor", "filter.v.option.cor", "filter.v.option.color", "filter.v.option.colour"];
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const families = {
    preto: ["preto", "preta", "pretos", "pretas"],
    azul: ["azul", "azuis"],
    vinho: ["vinho", "vinhos", "bordo"],
    marrom: ["marrom", "marrons"],
  };

  const initialize = async (section) => {
    if (section.dataset.colorFilterInitialized === "true") return;
    const url = new URL(window.location.href);
    const requested = [...new Set(colorParams.flatMap((key) => url.searchParams.getAll(key)).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean))];
    if (requested.length === 0) return;
    section.dataset.colorFilterInitialized = "true";
    const aliases = [...new Set(requested.flatMap((value) => families[normalize(value)] || [normalize(value)]))];
    const matches = (name) => normalize(name).split(/\s*(?:\/|\+|,|&|\be\b)\s*/i).some((part) => aliases.some((alias) => part === alias || part.startsWith(`${alias} `)));
    const grid = section.querySelector("[data-launches-track]");
    const pageData = section.querySelector("[data-collection-page-data]");
    if (!grid || !pageData) return;
    const count = section.querySelector("[data-collection-count]");
    const pagination = section.querySelector("[data-collection-pagination]");
    const empty = section.querySelector("[data-collection-empty]");
    const status = section.querySelector("[data-collection-color-status]");
    const message = section.querySelector("[data-collection-color-message]");
    const retry = section.querySelector("[data-collection-color-retry]");
    const pageSize = Number(pageData.dataset.pageSize) || 24;
    const totalPages = Math.max(1, Number(pageData.dataset.pages) || 1);
    const currentPage = Number(pageData.dataset.page) || 1;
    const pages = new Map([[currentPage, Array.from(grid.querySelectorAll("[data-launch-slide]"))]]);
    const colorLabel = requested[0];
    const clearUrl = new URL(url);
    colorParams.forEach((key) => clearUrl.searchParams.delete(key));
    clearUrl.searchParams.delete("page");
    section.querySelector("[data-collection-color-filter]").hidden = false;
    section.querySelector("[data-collection-color-label]").textContent = `Cor: ${colorLabel}`;
    section.querySelector("[data-collection-color-clear]").href = `${clearUrl.pathname}${clearUrl.search}`;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "cor";
    input.value = requested.join(",");
    section.querySelector(".main-collection__form").append(input);
    section.querySelectorAll(".main-collection__chip:not([data-collection-color-clear])").forEach((link) => {
      const filterUrl = new URL(link.href);
      filterUrl.searchParams.set("cor", requested.join(","));
      filterUrl.searchParams.delete("page");
      link.href = `${filterUrl.pathname}${filterUrl.search}`;
    });

    const loadPage = async (page) => {
      if (pages.has(page)) return;
      const requestUrl = new URL(clearUrl);
      requestUrl.searchParams.set("section_id", section.dataset.sectionId);
      requestUrl.searchParams.set("page", String(page));
      const response = await fetch(requestUrl, { headers: { Accept: "text/html" } });
      if (!response.ok) throw new Error("collection-page");
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      const source = doc.querySelector("[data-collection-colors]");
      if (!source) throw new Error("collection-section");
      pages.set(page, Array.from(source.querySelectorAll("[data-launch-slide]")));
    };

    const render = () => {
      const seen = new Set();
      const results = [];
      for (let page = 1; page <= totalPages; page += 1) {
        for (const slide of pages.get(page) || []) {
          const card = slide.querySelector("[data-launch-card]");
          if (!card || seen.has(card.dataset.productId)) continue;
          seen.add(card.dataset.productId);
          const swatches = Array.from(card.querySelectorAll("[data-launch-color]")).filter((swatch) => matches(swatch.dataset.colorName || ""));
          const swatch = swatches.find((item) => item.getAttribute("data-image-760")) || swatches[0];
          if (swatch) results.push({ slide, card, swatch });
        }
      }
      const resultPages = Math.max(1, Math.ceil(results.length / pageSize));
      const selectedPage = Math.max(1, Math.min(resultPages, Number.parseInt(url.searchParams.get("page"), 10) || 1));
      const visible = results.slice((selectedPage - 1) * pageSize, selectedPage * pageSize);
      grid.replaceChildren(...visible.map((item) => item.slide));
      window.UpyTheme.cards.initialize(section);
      visible.forEach(({ card, swatch }) => window.UpyTheme.cards.selectColor(card, swatch.dataset.colorName, swatch, true));
      count.textContent = `Exibindo ${results.length} ${results.length === 1 ? "resultado" : "resultados"}`;
      empty.hidden = results.length > 0;
      section.querySelector("[data-launches-carousel]").hidden = results.length === 0;
      if (results.length === 0) {
        empty.querySelector("p").textContent = `Não encontramos produtos na cor ${colorLabel} com os filtros escolhidos.`;
        const clear = document.createElement("a");
        clear.href = `${clearUrl.pathname}${clearUrl.search}`;
        clear.textContent = "Ver todas as cores";
        empty.append(clear);
      }
      pagination.replaceChildren();
      pagination.hidden = resultPages <= 1;
      const addPageLink = (page, text, label) => {
        const link = document.createElement("a");
        const pageUrl = new URL(url);
        pageUrl.searchParams.set("page", String(page));
        link.href = `${pageUrl.pathname}${pageUrl.search}`;
        link.textContent = text;
        link.setAttribute("aria-label", label);
        pagination.append(link);
      };
      if (selectedPage > 1) addPageLink(selectedPage - 1, "←", "Página anterior");
      const pageLabel = document.createElement("span");
      pageLabel.textContent = `${selectedPage} / ${resultPages}`;
      pagination.append(pageLabel);
      if (selectedPage < resultPages) addPageLink(selectedPage + 1, "→", "Próxima página");
      section.dataset.colorFilterState = "ready";
      section.setAttribute("aria-busy", "false");
      status.hidden = true;
    };

    const load = async () => {
      section.dataset.colorFilterState = "loading";
      section.setAttribute("aria-busy", "true");
      count.textContent = "Buscando produtos…";
      status.hidden = false;
      message.textContent = `Buscando produtos na cor ${colorLabel}…`;
      retry.hidden = true;
      pagination.hidden = true;
      empty.hidden = true;
      try {
        // Read every collection page before filtering so matches on later pages are included.
        for (let page = 1; page <= totalPages; page += 3) {
          await Promise.all(Array.from({ length: Math.min(3, totalPages - page + 1) }, (_, index) => loadPage(page + index)));
        }
        if (section.isConnected) render();
      } catch {
        section.dataset.colorFilterState = "error";
        section.setAttribute("aria-busy", "false");
        count.textContent = "";
        message.textContent = "Não foi possível carregar os produtos desta cor. Tente novamente.";
        retry.hidden = false;
      }
    };
    retry.addEventListener("click", load);
    await load();
  };

  const initializeSections = () => document.querySelectorAll("[data-collection-colors]").forEach(initialize);
  if (window.UpyTheme?.cards) initializeSections();
  else document.addEventListener("upy:cards:ready", initializeSections, { once: true });
  document.addEventListener("shopify:section:load", initializeSections);
})();
