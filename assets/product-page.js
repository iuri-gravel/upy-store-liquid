(() => {
  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const keyFor = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const namedColors = {
    amarelo: "#f4d83d", azul: "#2b3f5f", "azul-atena": "#2963af", "azul-bebe": "#a8d8f0",
    "azul-bic": "#1d4ed8", "azul-claro": "#8ecae6", "azul-marinho": "#152544", bege: "#d8c4a8",
    branco: "#fff", bordo: "#722f37", cafe: "#6f4e37", caramelo: "#b87845", chumbo: "#4b4f54",
    cinza: "#b8b8b8", coral: "#ef7b67", creme: "#eee1c6", dourado: "#c7a447", fucsia: "#d81b60",
    grafite: "#4a4a4a", laranja: "#d8a66f", lavanda: "#b5a1d8", lilas: "#ad82c4", marinho: "#1d2cf5",
    marrom: "#d17e67", nude: "#d7ad91", offwhite: "#f3efe6", pink: "#ec4899", preta: "#111",
    pretas: "#111", preto: "#111", rosa: "#e94791", "rosa-bebe": "#f3b8ca", "rosa-mesqueta": "#b3568c",
    "rosa-mosqueta": "#b3568c", pessego: "#ef8688", roxo: "#75449b", terracota: "#d8a66f", verde: "#68684d",
    "verde-militar": "#65734a", "verde-babosa": "#89b2bb", vermelho: "#d32f2f", vinho: "#752f43",
  };
  const colorFor = (name, button) => {
    const parts = normalize(name).split(/\s*(?:\/|\+|,|&|\be\b)\s*/).filter(Boolean);
    const assorted = /sortid|multicor|cores variadas/.test(normalize(name));
    if (assorted || parts.length > 1) {
      const colors = assorted ? ["#111", "#d32f2f", "#2667d9", "#ec4899", "#35945b", "#f4d83d"] : parts.map((part) => namedColors[keyFor(part)] || "#d3d1cd");
      button.style.setProperty("--swatch-color", `conic-gradient(${colors.map((color, index) => `${color} ${index * 100 / colors.length}% ${(index + 1) * 100 / colors.length}%`).join(",")})`);
      return;
    }
    button.style.setProperty("--swatch-color", namedColors[keyFor(name)] || (window.CSS?.supports("color", name) ? name : "#d3d1cd"));
  };

  document.querySelectorAll("[data-product-page]").forEach((page) => {
    if (page.dataset.initialized === "true") return;
    page.dataset.initialized = "true";
    const form = page.querySelector(".main-product__form");
    const variantsScript = page.querySelector("[data-product-variants]");
    const variantInput = page.querySelector("[data-variant-id]");
    const feedback = page.querySelector("[data-cart-feedback]");
    const selectionError = page.querySelector("[data-selection-error]");
    const quantityValue = page.querySelector("[data-quantity-value]");
    const quantityInput = page.querySelector("[data-quantity-input]");
    const viewersCount = page.querySelector("[data-social-viewers]");
    const soldCount = page.querySelector("[data-social-sold]");
    const stockRow = page.querySelector("[data-product-stock]");
    const stockLow = page.querySelector("[data-stock-low]");
    const stockOut = page.querySelector("[data-stock-out]");
    const stockQuantity = page.querySelector("[data-stock-quantity]");
    const stockThreshold = Math.max(1, Number(page.dataset.stockThreshold) || 8);
    const submitButton = page.querySelector("[data-add-to-cart]");
    const buyNowButton = page.querySelector("[data-buy-now]");
    const stickyAdd = page.querySelector("[data-sticky-add]");
    const stickyBar = page.querySelector("[data-sticky-product]");
    if (!form || !variantsScript || !variantInput) return;

    let variants = [];
    try { variants = JSON.parse(variantsScript.textContent || "[]"); } catch { variants = []; }
    if (!variants.length) return;
    const colorIndex = Number(page.dataset.colorOptionIndex);
    const sizeIndex = Number(page.dataset.sizeOptionIndex);
    const optionGroups = Array.from(page.querySelectorAll("[data-product-option]"));
    const colorValues = colorIndex >= 0 ? [...new Set(variants.map((variant) => variant.options[colorIndex]))] : [];
    const sizeValues = sizeIndex >= 0 ? [...new Set(variants.map((variant) => variant.options[sizeIndex]))] : [];
    const proofVariationSlots = Math.max(3, colorValues.length, sizeValues.length);
    const productSeed = String(page.dataset.productId || "").split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const initialVariant = variants.find((variant) => String(variant.id) === String(variantInput.value)) || variants.find((variant) => variant.available) || variants[0];
    const selected = Array.from(initialVariant.options || []);
    while (selected.length < 3) selected.push("");
    const params = new URLSearchParams(window.location.search);
    if (sizeIndex >= 0 && !params.get("variant") && !params.get("tamanho")) selected[sizeIndex] = "";
    if (colorIndex >= 0 && params.get("cor")) {
      const wantedColor = normalize(params.get("cor"));
      const matchedColor = variants.find((variant) => normalize(variant.options[colorIndex]) === wantedColor)?.options[colorIndex];
      if (matchedColor) selected[colorIndex] = matchedColor;
    }
    if (sizeIndex >= 0 && params.get("tamanho")) {
      const wantedSize = normalize(params.get("tamanho"));
      const matchedSize = variants.find((variant) => normalize(variant.options[sizeIndex]) === wantedSize && (colorIndex < 0 || normalize(variant.options[colorIndex]) === normalize(selected[colorIndex])) && variant.available)?.options[sizeIndex];
      if (matchedSize) selected[sizeIndex] = matchedSize;
    }

    const knownMatches = (variant, skipIndex = -1) => selected.every((value, index) => index === skipIndex || !value || normalize(variant.options[index]) === normalize(value));
    const exactVariant = () => variants.find((variant) => variant.options.every((value, index) => normalize(value) === normalize(selected[index] || "")));
    const matchingVariants = () => variants.filter((variant) => knownMatches(variant));
    const proofVariation = () => {
      const colorPosition = colorIndex >= 0 ? Math.max(0, colorValues.findIndex((value) => normalize(value) === normalize(selected[colorIndex]))) : 0;
      const sizePosition = sizeIndex >= 0 ? Math.max(0, sizeValues.findIndex((value) => normalize(value) === normalize(selected[sizeIndex]))) : 0;
      const normalizeIndex = (index) => ((index % proofVariationSlots) + proofVariationSlots) % proofVariationSlots;
      return (productSeed + normalizeIndex(colorPosition) + normalizeIndex(sizePosition)) % proofVariationSlots;
    };
    const viewers = Math.floor(Math.random() * 11) + 20;
    if (viewersCount) viewersCount.textContent = String(viewers);
    const getPriceVariant = () => {
      const exact = exactVariant();
      if (exact) return exact;
      const candidates = matchingVariants();
      return candidates.find((variant) => variant.available) || candidates[0] || initialVariant;
    };
    const hasRequiredSelection = () => (colorIndex < 0 || Boolean(selected[colorIndex])) && (sizeIndex < 0 || Boolean(selected[sizeIndex])) && optionGroups.every((group) => group.dataset.optionKind === "color" || group.dataset.optionKind === "size" || Boolean(selected[Number(group.dataset.optionIndex)]));
    const money = (cents) => new Intl.NumberFormat(document.documentElement.lang || "pt-BR", {
      style: "currency",
      currency: page.dataset.currency || "BRL",
    }).format(Number(cents || 0) / 100);
    const setGallery = (color) => {
      const media = Array.from(page.querySelectorAll("[data-product-media]"));
      const colorKey = keyFor(color);
      const colorMatches = colorKey ? media.filter((item) => item.dataset.mediaColors?.includes(`|${colorKey}|`)) : [];
      const visible = media.filter((item) => !colorKey || !colorMatches.length || !item.dataset.mediaColors || item.dataset.mediaColors === "|" || item.dataset.mediaColors.includes(`|${colorKey}|`));
      media.forEach((item) => {
        const show = visible.includes(item);
        item.hidden = !show;
        item.classList.toggle("is-active", show && item === visible[0]);
      });
      const dots = Array.from(page.querySelectorAll("[data-gallery-dot]"));
      dots.forEach((dot) => {
        const mediaItem = media.find((item) => item.dataset.mediaIndex === dot.dataset.mediaIndex);
        const show = Boolean(mediaItem && visible.includes(mediaItem));
        dot.hidden = !show;
        dot.setAttribute("aria-current", String(show && mediaItem === visible[0]));
      });
      if (visible.length) {
        const current = variants.find((variant) => normalize(variant.options[colorIndex]) === normalize(color) && variant.featuredMediaId);
        if (current) {
          const featured = visible.find((item) => String(item.dataset.mediaId) === String(current.featuredMediaId));
          if (featured) activateMedia(featured, visible, media);
        }
      }
      return visible;
    };
    const activateMedia = (item, visible = Array.from(page.querySelectorAll("[data-product-media]:not([hidden])")), all = Array.from(page.querySelectorAll("[data-product-media]"))) => {
      all.forEach((candidate) => candidate.classList.toggle("is-active", candidate === item));
      const index = visible.indexOf(item);
      page.querySelectorAll("[data-gallery-dot]").forEach((dot) => dot.setAttribute("aria-current", String(dot.dataset.mediaIndex === item.dataset.mediaIndex)));
      page.dataset.activeMediaIndex = String(index < 0 ? 0 : index);
    };
    const updateUrl = () => {
      const url = new URL(window.location.href);
      if (selected[colorIndex] && colorIndex >= 0) url.searchParams.set("cor", selected[colorIndex]);
      else url.searchParams.delete("cor");
      if (selected[sizeIndex] && sizeIndex >= 0) url.searchParams.set("tamanho", selected[sizeIndex]);
      else url.searchParams.delete("tamanho");
      const exact = exactVariant();
      if (exact) url.searchParams.set("variant", exact.id);
      else url.searchParams.delete("variant");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    };
    const update = ({ focusMedia = false } = {}) => {
      const priceVariant = getPriceVariant();
      const exact = exactVariant();
      const canPurchase = Boolean(exact?.available && hasRequiredSelection());
      const currentColor = colorIndex >= 0 ? selected[colorIndex] : "";
      if (soldCount) {
        const variation = proofVariation();
        const initialSold = 9 + variation;
        const soldLimit = 15 + variation;
        let reductions = 0;
        if (!(exact && exact.inventoryManagement && Number(exact.inventoryQuantity) <= 0)) {
          const now = new Date();
          if (now.getHours() >= 8) {
            const minutesSince8AM = (now.getHours() - 8) * 60 + now.getMinutes();
            reductions = Math.floor(minutesSince8AM / 150);
          }
        }
        soldCount.textContent = String(Math.min(soldLimit, initialSold + reductions));
      }
      if (stockRow && stockLow && stockOut && stockQuantity) {
        const tracksStock = Boolean(exact?.inventoryManagement) && exact.inventoryPolicy === "deny";
        const inventory = Number(exact?.inventoryQuantity);
        const isLowStock = tracksStock && Number.isFinite(inventory) && inventory > 0 && inventory <= stockThreshold;
        const isSoldOut = tracksStock && Number.isFinite(inventory) && inventory <= 0 && !exact?.available;
        stockRow.hidden = !isLowStock && !isSoldOut;
        stockLow.hidden = !isLowStock;
        stockOut.hidden = !isSoldOut;
        if (isLowStock) stockQuantity.textContent = String(inventory);
      }
      optionGroups.forEach((group) => {
        const index = Number(group.dataset.optionIndex);
        const kind = group.dataset.optionKind;
        const label = group.querySelector("[data-selected-option-label]");
        if (label) label.textContent = selected[index] || "";
        group.querySelectorAll("[data-option-button]").forEach((button) => {
          const value = button.dataset.optionValue || "";
          const isSelected = normalize(selected[index]) === normalize(value);
          const hasAvailableVariant = variants.some((variant) => variant.available && knownMatches(variant, index) && normalize(variant.options[index]) === normalize(value));
          button.setAttribute("aria-pressed", String(isSelected));
          button.disabled = !hasAvailableVariant;
          if (kind === "color") colorFor(value, button.querySelector("span"));
        });
        const select = group.querySelector("[data-option-select]");
        if (select) select.value = selected[index] || "";
      });
      if (priceVariant) {
        variantInput.value = String(exact?.id || priceVariant.id);
        const priceNode = page.querySelector("[data-product-price]");
        const pixNode = page.querySelector("[data-pix-price]");
        const installmentNode = page.querySelector("[data-installment-price]");
        const compareNode = page.querySelector("[data-compare-price]");
        if (priceNode) priceNode.textContent = money(priceVariant.price);
        if (pixNode) pixNode.textContent = money(Math.round(priceVariant.price * 0.95));
        if (installmentNode) installmentNode.textContent = money(Math.round(priceVariant.price / 3));
        if (compareNode) {
          compareNode.hidden = !(priceVariant.compareAtPrice > priceVariant.price);
          compareNode.textContent = priceVariant.compareAtPrice > priceVariant.price ? money(priceVariant.compareAtPrice) : "";
        }
        page.querySelectorAll("[data-sticky-price]").forEach((node) => { node.textContent = money(priceVariant.price); });
        if (submitButton) {
          submitButton.disabled = !priceVariant.available;
          submitButton.textContent = !priceVariant.available ? page.dataset.msgUnavailable : page.dataset.msgAdd;
        }
        if (buyNowButton) buyNowButton.disabled = !canPurchase;
        if (buyNowButton) buyNowButton.hidden = !canPurchase;
        if (stickyAdd) stickyAdd.disabled = !canPurchase;
        const max = priceVariant.inventoryManagement && priceVariant.inventoryPolicy !== "continue" ? Math.max(1, Number(priceVariant.inventoryQuantity) || 1) : 99;
        if (quantityValue) {
          quantityValue.max = String(max);
          quantityValue.value = String(Math.min(max, Math.max(1, Number(quantityValue.value) || 1)));
        }
        if (quantityInput && quantityValue) quantityInput.value = quantityValue.value;
        const increase = page.querySelector("[data-quantity-increase]");
        const decrease = page.querySelector("[data-quantity-decrease]");
        if (increase) increase.disabled = Number(quantityValue?.value || 1) >= max;
        if (decrease) decrease.disabled = Number(quantityValue?.value || 1) <= 1;
      }
      const visibleMedia = setGallery(currentColor);
      if (focusMedia && visibleMedia[0]) activateMedia(visibleMedia[0], visibleMedia);
      selectionError.hidden = true;
      updateUrl();
    };

    optionGroups.forEach((group) => {
      const index = Number(group.dataset.optionIndex);
      group.querySelectorAll("[data-option-button]").forEach((button) => {
        button.addEventListener("click", () => {
          const value = button.dataset.optionValue || "";
          selected[index] = value;
          if (index === colorIndex && sizeIndex >= 0 && selected[sizeIndex] && !variants.some((variant) => variant.available && normalize(variant.options[colorIndex]) === normalize(value) && normalize(variant.options[sizeIndex]) === normalize(selected[sizeIndex]))) selected[sizeIndex] = "";
          update({ focusMedia: index === colorIndex });
        });
      });
      group.querySelector("[data-option-select]")?.addEventListener("change", (event) => {
        selected[index] = event.currentTarget.value;
        update();
      });
    });

    const galleryVisible = () => Array.from(page.querySelectorAll("[data-product-media]:not([hidden])"));
    page.querySelectorAll("[data-gallery-dot]").forEach((dot) => dot.addEventListener("click", () => {
      const item = page.querySelector(`[data-product-media][data-media-index="${dot.dataset.mediaIndex}"]`);
      if (item && !item.hidden) activateMedia(item, galleryVisible());
    }));
    const shiftGallery = (direction) => {
      const visible = galleryVisible();
      if (visible.length < 2) return;
      const current = visible.findIndex((item) => item.classList.contains("is-active"));
      activateMedia(visible[(current + direction + visible.length) % visible.length], visible);
    };
    page.querySelector("[data-gallery-previous]")?.addEventListener("click", () => shiftGallery(-1));
    page.querySelector("[data-gallery-next]")?.addEventListener("click", () => shiftGallery(1));
    const mediaGrid = page.querySelector("[data-media-grid]");
    let touchStart = null;
    mediaGrid?.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    mediaGrid?.addEventListener("touchend", (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) shiftGallery(deltaX < 0 ? 1 : -1);
      touchStart = null;
    }, { passive: true });

    const lightbox = page.querySelector("[data-product-lightbox]");
    const lightboxContent = page.querySelector("[data-lightbox-content]");
    page.querySelectorAll("[data-open-lightbox]").forEach((button) => button.addEventListener("click", () => {
      const active = button.closest("[data-product-media]");
      if (!active || !lightbox || !lightboxContent) return;
      const media = active.querySelector("img, video, iframe, model-viewer");
      if (!media) return;
      const clone = media.cloneNode(true);
      clone.removeAttribute("id");
      if (clone instanceof HTMLVideoElement) clone.controls = true;
      lightboxContent.replaceChildren(clone);
      lightbox.showModal();
    }));
    page.querySelector("[data-lightbox-close]")?.addEventListener("click", () => lightbox?.close());
    lightbox?.addEventListener("click", (event) => { if (event.target === lightbox) lightbox.close(); });

    const sizeChart = page.querySelector("[data-size-chart-dialog]");
    page.querySelector("[data-size-chart-open]")?.addEventListener("click", () => sizeChart?.showModal());
    page.querySelector("[data-dialog-close]")?.addEventListener("click", () => sizeChart?.close());
    sizeChart?.addEventListener("click", (event) => { if (event.target === sizeChart) sizeChart.close(); });
    page.querySelector("[data-sizebay-open]")?.addEventListener("click", () => {
      const sizebayButton = Array.from(page.querySelectorAll("#sizebay-container button, .vfr__button--clean"))
        .find((button) => /descubra seu tamanho/i.test(button.textContent || ""));
      if (sizebayButton) sizebayButton.click();
      else sizeChart?.showModal();
    });

    const favoriteButton = page.querySelector("[data-product-wishlist]");
    const wishlistKey = "upy-wishlist-v1";
    const readWishlist = () => {
      try { const items = JSON.parse(localStorage.getItem(wishlistKey) || "[]"); return Array.isArray(items) ? items.filter((item) => item && item.id) : []; }
      catch { return []; }
    };
    const refreshFavorite = () => {
      if (!favoriteButton) return;
      const favorite = readWishlist().some((item) => String(item.id) === String(favoriteButton.dataset.productId));
      favoriteButton.setAttribute("aria-pressed", String(favorite));
      favoriteButton.setAttribute("aria-label", favorite ? favoriteButton.dataset.labelUnfavorite : favoriteButton.dataset.labelFavorite);
      const favoriteLabel = favoriteButton.querySelector("[data-favorite-label]");
      if (favoriteLabel) favoriteLabel.textContent = favorite ? favoriteButton.dataset.labelUnfavoriteText : favoriteButton.dataset.labelFavoriteText;
    };
    favoriteButton?.addEventListener("click", () => {
      const items = readWishlist();
      const id = favoriteButton.dataset.productId;
      const exists = items.some((item) => String(item.id) === String(id));
      const next = exists ? items.filter((item) => String(item.id) !== String(id)) : [...items, {
        id,
        title: favoriteButton.dataset.productTitle,
        handle: favoriteButton.dataset.productHandle,
        url: favoriteButton.dataset.productUrl,
        image: favoriteButton.dataset.productImage,
      }];
      localStorage.setItem(wishlistKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("upy:wishlist:change", { detail: next }));
      refreshFavorite();
    });
    window.addEventListener("upy:wishlist:change", refreshFavorite);
    window.addEventListener("storage", (event) => { if (event.key === wishlistKey) refreshFavorite(); });

    const updateQuantity = (next) => {
      if (!quantityValue) return;
      const min = Number(quantityValue.min) || 1;
      const max = Number(quantityValue.max) || 99;
      quantityValue.value = String(Math.min(max, Math.max(min, Math.floor(Number(next) || min))));
      if (quantityInput) quantityInput.value = quantityValue.value;
      update();
    };
    page.querySelector("[data-quantity-decrease]")?.addEventListener("click", () => updateQuantity(Number(quantityValue?.value || 1) - 1));
    page.querySelector("[data-quantity-increase]")?.addEventListener("click", () => updateQuantity(Number(quantityValue?.value || 1) + 1));
    quantityValue?.addEventListener("change", () => updateQuantity(quantityValue.value));

    const scrollToSize = () => {
      const sizeGroup = page.querySelector('[data-product-option][data-option-kind="size"]');
      sizeGroup?.scrollIntoView({ behavior: "smooth", block: "center" });
      sizeGroup?.querySelector("button")?.focus({ preventScroll: true });
    };
    const addToCart = async (buyNow = false) => {
      const variant = exactVariant();
      if (!hasRequiredSelection() || !variant) {
        if (selectionError) selectionError.hidden = false;
        scrollToSize();
        return;
      }
      if (!variant.available) {
        if (feedback) feedback.textContent = page.dataset.msgVariantUnavailable;
        return;
      }
      const buttons = [submitButton, buyNowButton, stickyAdd].filter(Boolean);
      buttons.forEach((button) => { button.disabled = true; });
      if (feedback) feedback.textContent = page.dataset.msgAdding;
      try {
        const root = window.Shopify?.routes?.root || "/";
        const response = await fetch(`${root.replace(/\/?$/, "/")}cart/add.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ id: Number(variant.id), quantity: Number(quantityValue?.value || 1) }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.description || result.message || page.dataset.msgAddError);
        if (buyNow) {
          window.location.assign(`${root.replace(/\/?$/, "/")}checkout`);
          return;
        }
        try { sessionStorage.setItem("upy-open-cart-after-launch-add", "true"); } catch { /* sessão pode estar bloqueada pelo navegador */ }
        window.location.reload();
      } catch (error) {
        if (feedback) feedback.textContent = error instanceof Error ? error.message : page.dataset.msgAddError;
        update();
      }
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); void addToCart(false); });
    buyNowButton?.addEventListener("click", () => void addToCart(true));
    stickyAdd?.addEventListener("click", () => void addToCart(false));

    const actionArea = page.querySelector("[data-product-actions]");
    const footer = document.querySelector("footer");
    const updateSticky = () => {
      if (!stickyBar || window.innerWidth > 999) return;
      const actionsRect = actionArea?.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      const pastActions = Boolean(actionsRect && actionsRect.bottom < 82);
      const footerNear = Boolean(footerRect && footerRect.top < window.innerHeight + 120);
      stickyBar.hidden = !pastActions || footerNear;
    };
    window.addEventListener("scroll", updateSticky, { passive: true });
    window.addEventListener("resize", updateSticky);
    updateSticky();
    refreshFavorite();
    update();
  });

  document.querySelectorAll("[data-product-recommendations]").forEach(async (section) => {
    if (!section.dataset.url) return;
    try {
      const response = await fetch(section.dataset.url, { credentials: "same-origin", headers: { Accept: "text/html" } });
      if (!response.ok) return;
      const html = await response.text();
      const documentFragment = new DOMParser().parseFromString(html, "text/html");
      const result = documentFragment.querySelector("[data-product-recommendations]");
      const cards = result?.querySelector(".product-recommendations__grid");
      if (!result || !cards?.childElementCount) return;
      section.innerHTML = result.innerHTML;
      section.hidden = false;
    } catch { /* recomendações indisponíveis não bloqueiam a página do produto */ }
  });

  const loadSizebay = async () => {
    const container = document.querySelector("[data-product-sizebay]");
    if (!container || document.querySelector("#sizebay-vfr-v4")) return;
    const addScript = (id, src) => new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    try {
      await addScript("sizebay-vfr-v4", "https://static.sizebay.technology/8192/prescript.js");
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "https://static.sizebay.technology/8192/styles/styles_v4.css";
      document.head.append(style);
      await addScript("szb-vfr__base", "https://vfr-v3-production.sizebay.technology/V4/implantation/index.js");
      if (typeof window.SizebayPrescript !== "function" || typeof window.Sizebay?.Implantation !== "function") return;
      const config = window.SizebayPrescript();
      const canonical = new URL(container.dataset.sizebayRoute || window.location.href, window.location.origin);
      canonical.search = "";
      canonical.hash = "";
      const provided = typeof config.getPermalink === "function" ? config.getPermalink() : "";
      const permalink = provided && new URL(provided, window.location.origin).pathname === canonical.pathname ? provided : canonical.toString();
      window.Sizebay.Implantation({
        permalink,
        tenantId: config.getTenantId(),
        buttons: config.getButtons(),
        anchor: config.getAnchor(),
        lang: config.getLanguage(),
        recommendation: config.getRecommendationText(),
      });
    } catch { /* o botão de tabela manual continua disponível se a Sizebay não carregar */ }
  };
  if (document.querySelector("[data-product-sizebay]")) void loadSizebay();
})();
