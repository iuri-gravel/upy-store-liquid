(() => {
  const storageKey = "upy-recently-viewed";
  const historyLimit = 8;
  const body = document.body;

  const parseHistory = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      const entries = parsed.flatMap((item) => {
        if (typeof item === "string" && item.trim()) return [{ id: item.trim(), handle: "" }];
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const id = String(item.id || "").trim();
        const handle = String(item.handle || "").trim();
        if (!id && !handle) return [];
        const color = typeof item.color === "string" ? item.color.trim() : "";
        return [{ id, handle, ...(color ? { color } : {}) }];
      });
      return entries.filter((entry, index) => entries.findIndex((current) =>
        (entry.handle && current.handle === entry.handle) || (entry.id && current.id === entry.id)
      ) === index);
    } catch {
      return [];
    }
  };

  const readHistory = () => {
    try { return parseHistory(window.localStorage.getItem(storageKey)); }
    catch { return []; }
  };

  const writeHistory = (entries) => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, historyLimit))); }
    catch { /* Storage can be unavailable in private browsing. */ }
  };

  const rememberProduct = (id, handle, color = "") => {
    if (!id && !handle) return;
    const history = readHistory();
    const existing = history.find((entry) => (handle && entry.handle === handle) || (id && entry.id === id));
    const selectedColor = color || existing?.color || "";
    const current = { id, handle, ...(selectedColor ? { color: selectedColor } : {}) };
    writeHistory([current, ...history.filter((entry) => entry.handle !== handle && entry.id !== id)]);
  };

  const productId = String(body.dataset.recentProductId || "");
  const productHandle = String(body.dataset.recentProductHandle || "");
  if (productId && productHandle) {
    const color = new URLSearchParams(window.location.search).get("cor")?.trim() || "";
    rememberProduct(productId, productHandle, color);
  }

  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const namedColors = {
    amarelo: "#f4d83d", azul: "#2b3f5f", "azul atena": "#2963af", "azul bebe": "#a8d8f0",
    "azul bic": "#1d4ed8", "azul claro": "#8ecae6", "azul marinho": "#152544", "azul navy": "#2b3f5f",
    bege: "#d8c4a8", branco: "#ffffff", bordo: "#722f37", cafe: "#6f4e37", caramelo: "#b87845",
    chumbo: "#4b4f54", cinza: "#b8b8b8", coral: "#ef7b67", creme: "#eee1c6", dourado: "#c7a447",
    fucsia: "#d81b60", grafite: "#4a4a4a", laranja: "#d8a66f", lavanda: "#b5a1d8", lilas: "#ad82c4",
    marinho: "#1d2cf5", marrom: "#d17e67", nude: "#d7ad91", offwhite: "#f3efe6", pink: "#ec4899",
    preta: "#111111", pretas: "#111111", preto: "#111111", rosa: "#e94791", "rosa bebe": "#f3b8ca",
    "rosa mesqueta": "#b3568c", "rosa mosqueta": "#b3568c", pessego: "#ef8688", roxo: "#75449b",
    terracota: "#d8a66f", verde: "#68684d", "verde militar": "#65734a", "verde babosa": "#89b2bb",
    vermelho: "#d32f2f", vinho: "#752f43",
  };

  const swatchColor = (value) => {
    const normalized = normalize(value);
    const parts = normalized.split(/\s*(?:\/|\+|,|&|\be\b)\s*/i).filter(Boolean);
    if (/sortid|multicor|cores variadas/.test(normalized)) {
      return "conic-gradient(#111 0% 16.6%, #d32f2f 16.6% 33.3%, #2667d9 33.3% 50%, #ec4899 50% 66.6%, #35945b 66.6% 83.3%, #f4d83d 83.3% 100%)";
    }
    if (parts.length > 1) {
      return `conic-gradient(${parts.map((part, index) => {
        const start = index * 100 / parts.length;
        const end = (index + 1) * 100 / parts.length;
        return `${namedColors[part] || "#d3d1cd"} ${start}% ${end}%`;
      }).join(", ")})`;
    }
    return namedColors[normalized] || (window.CSS?.supports("color", value) ? value : "#d3d1cd");
  };

  const optionName = (option) => typeof option === "string" ? option : String(option?.name || "");
  const colorIndexFor = (product) => (product.options || []).findIndex((option) => {
    const name = normalize(optionName(option));
    return ["cor", "color", "colour"].includes(name);
  });
  const variantColor = (variant, index) => index < 0 ? "" : String(variant[`option${index + 1}`] || "").trim();
  const imageUrl = (image) => typeof image === "string" ? image : String(image?.src || "");
  const formatMoney = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);
  const rootPath = () => window.Shopify?.routes?.root || "/";

  const variantImageFor = (product, color, colorIndex) => {
    const match = (product.variants || []).find((variant) =>
      color && normalize(variantColor(variant, colorIndex)) === normalize(color) && imageUrl(variant.featured_image)
    );
    return imageUrl(match?.featured_image) || imageUrl(product.featured_image) || product.images?.[0] || "";
  };

  const priceFor = (product, color, colorIndex) => {
    const variants = (product.variants || []).filter((variant) =>
      !color || normalize(variantColor(variant, colorIndex)) === normalize(color)
    );
    const prices = variants.map((variant) => Number(variant.price)).filter(Number.isFinite);
    return prices.length ? Math.min(...prices) : Number(product.price_min ?? product.price ?? 0);
  };

  const resizeImage = (url, width) => {
    try {
      const resized = new URL(url, window.location.origin);
      resized.searchParams.set("width", String(width));
      return resized.toString();
    } catch {
      return url;
    }
  };

  const cardProductData = new WeakMap();

  const saveSelectedColor = (card, color) => {
    const history = readHistory();
    const target = history.find((entry) => entry.handle === card.dataset.productHandle || entry.id === card.dataset.productId);
    if (!target) return;
    const next = history.map((entry) => entry === target ? { ...entry, color } : entry);
    writeHistory(next);
  };

  const updateCardColor = (card, product, color, colorIndex) => {
    card.dataset.activeColor = color;
    const displayColor = /sortid|multicor|cores variadas/i.test(normalize(color)) ? "Sortido" : color;
    const label = card.querySelector("[data-recent-color-label]");
    if (label) {
      label.textContent = displayColor;
      label.hidden = !displayColor;
    }
    const image = card.querySelector("[data-recent-image]");
    const selectedImage = variantImageFor(product, color, colorIndex);
    if (image && selectedImage) {
      image.src = resizeImage(selectedImage, 760);
      image.srcset = `${resizeImage(selectedImage, 480)} 480w, ${resizeImage(selectedImage, 760)} 760w, ${resizeImage(selectedImage, 1000)} 1000w`;
      image.alt = `${product.title || "Produto"}${displayColor ? ` na cor ${displayColor}` : ""}`;
    }
    const price = priceFor(product, color, colorIndex);
    const priceNode = card.querySelector("[data-recent-price]");
    const pixNode = card.querySelector("[data-recent-pix]");
    if (priceNode) priceNode.textContent = formatMoney(price);
    if (pixNode) pixNode.textContent = `${formatMoney(Math.round(price * 0.95))} no Pix`;
    card.querySelectorAll("[data-recent-link]").forEach((link) => {
      const url = new URL(link.dataset.productBaseUrl, window.location.origin);
      if (color) url.searchParams.set("cor", color);
      link.href = `${url.pathname}${url.search}${url.hash}`;
    });
    card.querySelectorAll("[data-recent-swatch]").forEach((button) => {
      const selected = normalize(button.dataset.colorName) === normalize(color);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  };

  const createCard = (product, entry) => {
    const handle = String(product.handle || entry.handle || "");
    if (!handle) return null;
    const productUrl = `${rootPath().replace(/\/?$/, "/")}products/${encodeURIComponent(handle)}`;
    const colorIndex = colorIndexFor(product);
    const colors = [];
    if (colorIndex >= 0) {
      (product.variants || []).forEach((variant) => {
        const name = variantColor(variant, colorIndex);
        if (!name || ["img 1", "img 2"].includes(normalize(name))) return;
        if (!colors.some((color) => normalize(color) === normalize(name))) colors.push(name);
      });
    }
    const selectedColor = colors.find((color) => normalize(color) === normalize(entry.color)) || colors[0] || "";
    const article = document.createElement("article");
    article.className = "home-recent__card";
    article.dataset.productId = String(product.id || entry.id || "");
    article.dataset.productHandle = handle;
    cardProductData.set(article, product);

    const imageLink = document.createElement("a");
    imageLink.className = "home-recent__image-link";
    imageLink.dataset.recentLink = "";
    imageLink.dataset.productBaseUrl = productUrl;
    imageLink.setAttribute("aria-label", `Ver ${product.title || "produto"}`);
    const imageWrap = document.createElement("div");
    imageWrap.className = "home-recent__image-wrap";
    const image = document.createElement("img");
    image.className = "home-recent__image";
    image.dataset.recentImage = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 500;
    image.height = 625;
    imageWrap.append(image);
    imageLink.append(imageWrap);

    const details = document.createElement("div");
    details.className = "home-recent__details";
    if (colors.length) {
      const swatches = document.createElement("div");
      swatches.className = "home-recent__swatches";
      swatches.setAttribute("role", "group");
      swatches.setAttribute("aria-label", `Cores disponíveis para ${product.title || "produto"}`);
      colors.slice(0, 5).forEach((color) => {
        const button = document.createElement("button");
        button.className = "home-recent__swatch";
        button.type = "button";
        button.dataset.recentSwatch = "";
        button.dataset.colorName = color;
        button.setAttribute("aria-label", `Selecionar cor ${color}`);
        button.setAttribute("aria-pressed", "false");
        button.title = color;
        const dot = document.createElement("span");
        dot.className = "home-recent__swatch-dot";
        dot.style.background = swatchColor(color);
        dot.setAttribute("aria-hidden", "true");
        button.append(dot);
        swatches.append(button);
      });
      if (colors.length > 5) {
        const more = document.createElement("span");
        more.className = "home-recent__swatch-more";
        more.textContent = `+${colors.length - 5}`;
        swatches.append(more);
      }
      details.append(swatches);
    }

    const titleLink = document.createElement("a");
    titleLink.className = "home-recent__product-link";
    titleLink.dataset.recentLink = "";
    titleLink.dataset.productBaseUrl = productUrl;
    const title = document.createElement("h3");
    title.className = "home-recent__product-title";
    title.textContent = product.title || "Produto";
    titleLink.append(title);
    const colorLabel = document.createElement("p");
    colorLabel.className = "home-recent__color-label";
    colorLabel.dataset.recentColorLabel = "";
    const price = document.createElement("p");
    price.className = "home-recent__price";
    price.dataset.recentPrice = "";
    const pix = document.createElement("p");
    pix.className = "home-recent__pix";
    pix.dataset.recentPix = "";
    details.append(titleLink, colorLabel, price, pix);
    article.append(imageLink, details);
    updateCardColor(article, product, selectedColor, colorIndex);
    return article;
  };


  const productRequests = new Map();
  const fetchProduct = (handle) => {
    if (productRequests.has(handle)) return productRequests.get(handle);
    const endpoint = rootPath().replace(/\/?$/, "/") + "products/" + encodeURIComponent(handle) + ".js";
    const request = fetch(endpoint, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null).catch(() => null);
    productRequests.set(handle, request);
    return request;
  };
  const initializeSections = (scope = document) => {
    scope.querySelectorAll("[data-recently-viewed]").forEach((section) => {
      if (section.dataset.initialized === "true") return;
      section.dataset.initialized = "true";
      const grid = section.querySelector("[data-recently-viewed-grid]");
      if (!grid) return;
      const load = async () => {
        const currentId = String(body.dataset.recentProductId || "");
        const entries = readHistory().filter((entry) => entry.id !== currentId && entry.handle).slice(0, historyLimit);
        const limit = Math.min(historyLimit, Math.max(1, Number(section.dataset.productLimit) || 4));
        const products = [];
        let offset = 0;
        while (offset < entries.length && products.length < limit) {
          const batch = entries.slice(offset, offset + limit - products.length);
          offset += batch.length;
          const results = await Promise.all(batch.map(async (entry) => ({ product: await fetchProduct(entry.handle), entry })));
          products.push(...results.filter(({ product }) => product && String(product.id) !== currentId));
        }
        products.forEach(({ product, entry }) => { const card = createCard(product, entry); if (card) grid.append(card); });
        if (grid.childElementCount) {
          section.hidden = false;
          const status = section.querySelector("[data-recently-viewed-status]");
          if (status) status.textContent = grid.childElementCount + " produtos vistos recentemente";
        }
      };
      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          void load();
        }, { rootMargin: "600px" });
        observer.observe(section.closest(".shopify-section") || section.parentElement);
      } else void load();
    });
  };

  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-recent-swatch]") : null;
    if (button) {
      const card = button.closest("[data-product-handle]");
      const product = card && cardProductData.get(card);
      if (!card || !product) return;
      updateCardColor(card, product, button.dataset.colorName || "", colorIndexFor(product));
      saveSelectedColor(card, button.dataset.colorName || "");
      return;
    }

    const link = event.target instanceof Element ? event.target.closest("a[data-launch-product-link], a[data-recent-link]") : null;
    const card = link?.closest("[data-product-id][data-product-handle]");
    if (!link || !card) return;
    const color = new URL(link.href, window.location.origin).searchParams.get("cor") || card.dataset.activeColor || "";
    rememberProduct(card.dataset.productId || "", card.dataset.productHandle || "", color);
  }, true);

  const start = () => initializeSections();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  document.addEventListener("shopify:section:load", (event) => initializeSections(event.target));
})();
