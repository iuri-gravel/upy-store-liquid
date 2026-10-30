(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const { readWishlist, writeWishlist, wishlistKey } = window.UpyTheme;
  const launchColorMap = {
    amarelo: "#f4d83d",
    azul: "#2b3f5f",
    "azul atena": "#2963af",
    "azul bebe": "#a8d8f0",
    "azul bic": "#1d4ed8",
    "azul claro": "#8ecae6",
    "azul marinho": "#152544",
    "azul navy": "#31415c",
    bege: "#d8c4a8",
    branco: "#ffffff",
    bordo: "#722f37",
    cafe: "#6f4e37",
    caramelo: "#b87845",
    chumbo: "#4b4f54",
    cinza: "#b8b8b8",
    coral: "#ef7b67",
    creme: "#eee1c6",
    dourado: "#c7a447",
    fucsia: "#d81b60",
    grafite: "#4a4a4a",
    laranja: "#d8a66f",
    lavanda: "#b5a1d8",
    lilas: "#ad82c4",
    marinho: "#1d2cf5",
    marrom: "#d17e67",
    navy: "#31415c",
    nude: "#d7ad91",
    offwhite: "#f3efe6",
    pink: "#ec4899",
    preta: "#111111",
    pretas: "#111111",
    preto: "#111111",
    rosa: "#e94791",
    "rosa bebe": "#f3b8ca",
    "rosa mesqueta": "#b3568c",
    "rosa mosqueta": "#b3568c",
    pessego: "#ef8688",
    roxo: "#75449b",
    terracota: "#d8a66f",
    verde: "#68684d",
    "verde militar": "#65734a",
    "verde babosa": "#89b2bb",
    vermelho: "#d32f2f",
    vinho: "#752f43",
  };
  const normalizeLaunchColor = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const getLaunchColorValue = (value) => {
    const color = normalizeLaunchColor(value);
    const parts = color.split(/\s*(?:\/|\+|,|&|\be\b)\s*/i).filter(Boolean);
    if (color.includes("sortido") || color.includes("sortida") || color.includes("cores variadas") || color.includes("multicor")) {
      return "conic-gradient(#111111 0% 16.66%, #d32f2f 16.66% 33.33%, #2667d9 33.33% 50%, #ec4899 50% 66.66%, #35945b 66.66% 83.33%, #f4d83d 83.33% 100%)";
    }
    if (parts.length > 1) {
      const stops = parts.map((part, index) => {
        const hex = launchColorMap[part] || "#d3d1cd";
        const start = (index / parts.length) * 100;
        const end = ((index + 1) / parts.length) * 100;
        return `${hex} ${start}% ${end}%`;
      });
      return `conic-gradient(${stops.join(", ")})`;
    }
    return launchColorMap[color] || "#d3d1cd";
  };
  const displayLaunchColor = (value) => {
    const normalized = normalizeLaunchColor(value);
    return normalized.includes("sortido") || normalized.includes("sortida") || normalized.includes("cores variadas") || normalized.includes("multicor") ? "Sortido" : value;
  };

  const updateLaunchWishlistButtons = () => {
    const saved = readWishlist();
    document.querySelectorAll("[data-launch-wishlist]").forEach((button) => {
      const isSaved = saved.some((item) => String(item.id) === button.dataset.productId);
      button.classList.toggle("is-saved", isSaved);
      button.setAttribute("aria-pressed", String(isSaved));
      button.setAttribute("aria-label", `${isSaved ? "Remover" : "Adicionar"} ${button.dataset.productTitle} ${isSaved ? "dos" : "aos"} favoritos`);
    });
  };
  const setCardColor = (card, color, swatch, updateImage) => {
    const normalizedColor = normalizeLaunchColor(color);
    card.dataset.activeColor = color;
    const label = card.querySelector("[data-launch-color-label]");
    if (label) {
      label.hidden = false;
      label.textContent = displayLaunchColor(color);
    }

    if (swatch) {
      card.querySelectorAll("[data-launch-color]").forEach((button) => {
        const selected = button === swatch;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }

    if (updateImage && swatch) {
      const image = card.querySelector("[data-launch-image]");
      const placeholder = card.querySelector("[data-launch-image-placeholder]");
      const src480 = swatch.getAttribute("data-image-480");
      const src760 = swatch.getAttribute("data-image-760");
      const src1000 = swatch.getAttribute("data-image-1000");
      const src = src760 || src1000 || src480;
      if (image) {
        if (src) {
          image.srcset = [src480 && `${src480} 480w`, src760 && `${src760} 760w`, src1000 && `${src1000} 1000w`].filter(Boolean).join(", ");
          image.src = src;
        } else {
          image.removeAttribute("srcset");
          image.removeAttribute("src");
        }
        image.hidden = !src;
        image.alt = `${card.dataset.productTitle} na cor ${displayLaunchColor(color)}`;
      }
      if (placeholder) placeholder.hidden = Boolean(src);
      const wishlist = card.querySelector("[data-launch-wishlist]");
      if (wishlist) wishlist.dataset.productImage = src || "";
    }

    card.querySelectorAll("[data-launch-product-link]").forEach((link) => {
      const baseUrl = link.dataset.productBaseUrl;
      if (!baseUrl) return;
      const url = new URL(baseUrl, window.location.origin);
      if (color) url.searchParams.set("cor", color);
      else url.searchParams.delete("cor");
      link.href = `${url.pathname}${url.search}${url.hash}`;
      const wishlist = card.querySelector("[data-launch-wishlist]");
      if (wishlist) wishlist.dataset.productUrl = link.href;
    });

    card.querySelectorAll("[data-launch-size]").forEach((button) => {
      const sizeColor = normalizeLaunchColor(button.dataset.sizeColor || "");
      button.hidden = Boolean(sizeColor && sizeColor !== normalizedColor);
    });
  };

  const initializeCard = (card) => {
    if (card.dataset.cardInitialized === "true") return;
    card.dataset.cardInitialized = "true";
    card.querySelectorAll("[data-launch-swatch-dot]").forEach((dot) => {
      dot.style.background = getLaunchColorValue(dot.dataset.colorName || "");
    });
    const activeColor = card.dataset.activeColor || "";
    if (activeColor) setCardColor(card, activeColor, null, false);

    card.querySelectorAll("[data-launch-color]").forEach((button) => {
      button.addEventListener("click", () => setCardColor(card, button.dataset.colorName || "", button, true));
    });

    card.querySelectorAll("[data-launch-wishlist]").forEach((button) => {
      button.addEventListener("click", () => {
        const items = readWishlist();
        const productId = button.dataset.productId;
        const alreadySaved = items.some((item) => String(item.id) === productId);
        const nextItems = alreadySaved
          ? items.filter((item) => String(item.id) !== productId)
          : [...items, {
              id: productId,
              title: button.dataset.productTitle,
              handle: button.dataset.productHandle,
              url: button.dataset.productUrl,
              image: button.dataset.productImage,
            }];
        writeWishlist(nextItems);
      });
    });

    card.querySelectorAll("[data-launch-size]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (button.disabled || button.dataset.pending === "true") return;
        const feedback = card.querySelector("[data-launch-cart-feedback]");
        button.dataset.pending = "true";
        button.disabled = true;
        if (feedback) feedback.textContent = "Adicionando à sacola…";
        const root = window.Shopify?.routes?.root || "/";
        const endpoint = `${root.replace(/\/?$/, "/")}cart/add.js`;
        try {
          if (window.UpyTheme?.cart) {
            await window.UpyTheme.cart.add([{ id: Number(button.dataset.variantId), quantity: 1 }]);
            if (feedback) feedback.textContent = "";
          } else {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ id: Number(button.dataset.variantId), quantity: 1 }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.description || result.message || "Não foi possível adicionar este tamanho.");
            try { window.sessionStorage.setItem("upy-open-cart-after-launch-add", "true"); } catch {}
            window.location.reload();
          }
          button.dataset.pending = "false";
          button.disabled = false;
        } catch (error) {
          button.dataset.pending = "false";
          button.disabled = false;
          if (feedback) feedback.textContent = error instanceof Error ? error.message : "Não foi possível adicionar à sacola.";
        }
      });
    });
  };

  const initializeCards = (scope = document) => {
    const sections = scope.matches?.("[data-home-launches]") ? [scope] : scope.querySelectorAll("[data-home-launches]");
    sections.forEach((section) => {
      section.querySelectorAll("[data-launch-card]").forEach(initializeCard);
      if (section.dataset.cardsInitialized === "true") return;
      section.dataset.cardsInitialized = "true";
      const carousel = section.querySelector("[data-launches-carousel]");
      const track = section.querySelector("[data-launches-track]");
      const slides = Array.from(section.querySelectorAll("[data-launch-slide]"));
      const previous = section.querySelector("[data-launches-previous]");
      const next = section.querySelector("[data-launches-next]");
      const status = section.querySelector("[data-launches-status]");
      if (!carousel || !track || slides.length === 0) return;

      let scrollFrame = 0;
      const updateCarousel = () => {
        const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
        const canScroll = maxScroll > 2;
        carousel.classList.toggle("has-overflow", canScroll);
        const leadingInset = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0;
        if (previous) previous.disabled = track.scrollLeft <= leadingInset + 2;
        if (next) next.disabled = maxScroll - track.scrollLeft <= 2;

        if (status) {
          const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
          const slideWidth = slides[0].getBoundingClientRect().width + gap;
          const activeIndex = slideWidth > 0 ? Math.max(0, Math.min(slides.length - 1, Math.round((track.scrollLeft - leadingInset) / slideWidth))) : 0;
          status.textContent = `Lançamento ${activeIndex + 1} de ${slides.length}`;
        }
      };
      const scrollByCard = (direction) => {
        const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
        const slideWidth = slides[0].getBoundingClientRect().width + gap;
        track.scrollBy({ left: direction * slideWidth, behavior: reducedMotion.matches ? "auto" : "smooth" });
      };

      previous?.addEventListener("click", () => scrollByCard(-1));
      next?.addEventListener("click", () => scrollByCard(1));
      track.addEventListener("scroll", () => {
        window.cancelAnimationFrame(scrollFrame);
        scrollFrame = window.requestAnimationFrame(updateCarousel);
      }, { passive: true });
      window.addEventListener("resize", updateCarousel, { passive: true });
      if ("ResizeObserver" in window) new ResizeObserver(updateCarousel).observe(track);


      updateCarousel();
    });
    updateLaunchWishlistButtons();
  };
  window.UpyTheme.cards = { initialize: initializeCards, selectColor: setCardColor };
  initializeCards();
  document.dispatchEvent(new Event("upy:cards:ready"));
  window.addEventListener("upy:wishlist:change", updateLaunchWishlistButtons);
  window.addEventListener("storage", (event) => { if (event.key === wishlistKey) updateLaunchWishlistButtons(); });
  document.addEventListener("shopify:section:load", (event) => initializeCards(event.target));
})();
