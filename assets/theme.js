(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-announcement-bar]").forEach((bar) => {
    const messages = Array.from(bar.querySelectorAll("[data-announcement-message]"));
    if (messages.length < 2) return;

    let activeIndex = 0;
    let timer = 0;
    let transitionTimer = 0;

    const isPaused = () => bar.matches(":hover") || document.hidden || reducedMotion.matches;

    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
      if (transitionTimer) {
        window.clearTimeout(transitionTimer);
        transitionTimer = 0;
        messages[activeIndex].classList.add("is-active");
      }
    };

    const showMessage = (nextIndex) => {
      const current = messages[activeIndex];
      const next = messages[nextIndex];
      current.classList.remove("is-active");
      transitionTimer = window.setTimeout(() => {
        current.hidden = true;
        next.hidden = false;
        activeIndex = nextIndex;
        window.requestAnimationFrame(() => next.classList.add("is-active"));
      }, 300);
    };

    const start = () => {
      stop();
      if (isPaused()) return;
      const interval = Number(bar.dataset.interval) || 4000;
      timer = window.setInterval(() => {
        if (isPaused()) return;
        showMessage((activeIndex + 1) % messages.length);
      }, interval);
    };

    bar.addEventListener("mouseenter", stop);
    bar.addEventListener("mouseleave", start);
    bar.addEventListener("focusin", stop);
    bar.addEventListener("focusout", (event) => {
      if (!bar.contains(event.relatedTarget)) start();
    });
    document.addEventListener("visibilitychange", start);
    reducedMotion.addEventListener("change", start);
    start();
  });

  document.querySelectorAll("[data-site-header]").forEach((header) => {
    const update = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    update();
    let headerFrame = 0;
    const scheduleHeader = () => {
      if (headerFrame) return;
      headerFrame = window.requestAnimationFrame(() => { headerFrame = 0; update(); updateMegaMenuPosition(); });
    };
    window.addEventListener("scroll", scheduleHeader, { passive: true });

    const utilityMenu = header.querySelector("[data-utility-menu]");
    if (utilityMenu) {
      document.addEventListener("pointerdown", (event) => {
        if (utilityMenu.open && !utilityMenu.contains(event.target)) utilityMenu.open = false;
      });
      utilityMenu.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !utilityMenu.open) return;
        event.preventDefault();
        utilityMenu.open = false;
        utilityMenu.querySelector("summary")?.focus();
      });
    }

    const dialogs = {
      menu: header.querySelector("[data-menu-dialog]"),
      search: header.querySelector("[data-search-dialog]"),
      wishlist: header.querySelector("[data-wishlist-dialog]"),
      cart: header.querySelector("[data-cart-dialog]"),
    };

    header.querySelectorAll("[data-dialog-open]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const dialog = dialogs[trigger.dataset.dialogOpen];
        if (!dialog) return;
        if (dialog.open) {
          dialog.close();
          return;
        }
        Object.values(dialogs).forEach((otherDialog) => {
          if (otherDialog?.open) otherDialog.close();
        });
        dialog.showModal();
        trigger.setAttribute("aria-expanded", "true");
        if (trigger.dataset.dialogOpen === "search") {
          const input = dialog.querySelector("[data-predictive-search-input]");
          window.setTimeout(() => {
            input?.focus();
            if (input?.value.trim()) input.dispatchEvent(new Event("input", { bubbles: true }));
          }, 30);
        }
        if (trigger.dataset.dialogOpen === "wishlist") renderWishlist();
      });
    });

    Object.entries(dialogs).forEach(([name, dialog]) => {
      if (!dialog) return;
      dialog.querySelectorAll("[data-dialog-close]").forEach((button) => {
        button.addEventListener("click", () => dialog.close());
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("close", () => {
        header.querySelectorAll(`[data-dialog-open="${name}"]`).forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
      });
    });

    header.querySelectorAll(".site-header__nav-group").forEach((group) => {
      const trigger = group.querySelector(".site-header__nav-trigger");
      let closeTimer = 0;
      const setExpanded = (expanded) => {
        if (expanded) {
          const megaMenu = group.querySelector(".site-header__mega");
          megaMenu?.style.setProperty("--header-mega-top", `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
        }
        group.classList.toggle("is-open", expanded);
        trigger?.setAttribute("aria-expanded", String(expanded));
      };
      group.addEventListener("mouseenter", () => {
        window.clearTimeout(closeTimer);
        setExpanded(true);
      });
      group.addEventListener("mouseleave", () => {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => setExpanded(false), 140);
      });
      group.addEventListener("focusin", () => setExpanded(true));
      group.addEventListener("focusout", (event) => {
        if (!group.contains(event.relatedTarget)) setExpanded(false);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        setExpanded(false);
        trigger?.focus();
      });
    });

    const updateMegaMenuPosition = () => {
      if (!header.querySelector(".site-header__nav-group.is-open")) return;
      const headerBottom = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
      header.querySelectorAll(".site-header__nav-group.is-open .site-header__mega").forEach((megaMenu) => {
        megaMenu.style.setProperty("--header-mega-top", headerBottom);
      });
    };
    window.addEventListener("resize", scheduleHeader);
  });

  const searchDialog = document.querySelector("[data-search-dialog]");
  if (searchDialog) {
    const input = searchDialog.querySelector("[data-predictive-search-input]");
    const results = searchDialog.querySelector("[data-search-results]");
    const initial = searchDialog.querySelector("[data-search-initial]");
    let searchTimer = 0;
    let searchController = null;
    const searchCache = new Map();
    const searchMoney = new Intl.NumberFormat(document.documentElement.lang || "pt-BR", { style: "currency", currency: searchDialog.dataset.currency || "BRL" });
    searchDialog.addEventListener("close", () => { window.clearTimeout(searchTimer); searchController?.abort(); });

    const appendHeading = (container, text) => {
      const heading = document.createElement("h3");
      heading.className = "site-header__suggestion-heading";
      heading.textContent = text;
      container.append(heading);
    };

    const appendLink = (container, item, kind) => {
      const link = document.createElement("a");
      link.className = kind === "product" ? "site-header__suggestion-product" : "site-header__suggestion-collection";
      link.href = item.url || "#";
      link.setAttribute("role", "option");
      if (kind === "product") {
        const imageUrl = typeof item.featured_image === "string"
          ? item.featured_image
          : item.featured_image?.url || item.image?.url || item.image;
        if (imageUrl) {
          const image = document.createElement("img");
          const resized = new URL(imageUrl, window.location.origin);
          resized.searchParams.set("width", "180");
          image.src = resized.toString();
          image.width = 72;
          image.height = 90;
          image.alt = "";
          image.loading = "lazy";
          link.append(image);
        }
        const details = document.createElement("span");
        details.className = "site-header__suggestion-product-copy";
        const title = document.createElement("span");
        title.className = "site-header__suggestion-title";
        title.textContent = item.title || "";
        details.append(title);
        if (item.price !== undefined && item.price !== null) {
          const price = document.createElement("span");
          price.className = "site-header__suggestion-price";
          price.textContent = searchMoney.format(Number(item.price));
          details.append(price);
        }
        link.append(details);
      } else {
        link.textContent = item.title || "";
      }
      container.append(link);
    };

    const appendQuerySuggestions = (container, queries) => {
      if (!queries.length) return;

      const queryGroup = document.createElement("section");
      queryGroup.className = "site-header__suggestion-queries";
      appendHeading(queryGroup, searchDialog.dataset.searchQueries);
      queries.forEach((item) => {
        const link = document.createElement("a");
        const queryText = item.text || "";
        link.className = "site-header__suggestion-query";
        link.href = item.url || `${searchDialog.querySelector("form").action}?${new URLSearchParams({ q: queryText })}`;
        link.textContent = queryText;
        link.setAttribute("role", "option");
        queryGroup.append(link);
      });
      container.append(queryGroup);
    };

    const renderResults = (payload, query) => {
      const data = payload?.resources?.results || {};
      const queries = Array.isArray(data.queries) ? data.queries : [];
      const products = Array.isArray(data.products) ? data.products : [];
      const collections = Array.isArray(data.collections) ? data.collections : [];
      results.replaceChildren();
      if (!queries.length && !products.length && !collections.length) {
        results.textContent = searchDialog.dataset.searchEmpty;
        results.hidden = false;
        input.setAttribute("aria-expanded", "true");
        return;
      }

      const layout = document.createElement("div");
      layout.className = "site-header__suggestion-layout";
      appendQuerySuggestions(layout, queries);
      if (collections.length) {
        const collectionGroup = document.createElement("section");
        collectionGroup.className = "site-header__suggestion-collections";
        appendHeading(collectionGroup, searchDialog.dataset.searchCollections);
        collections.forEach((item) => appendLink(collectionGroup, item, "collection"));
        layout.append(collectionGroup);
      }
      if (products.length) {
        const productGroup = document.createElement("section");
        productGroup.className = "site-header__suggestion-products";
        appendHeading(productGroup, searchDialog.dataset.searchProducts);
        products.forEach((item) => appendLink(productGroup, item, "product"));
        layout.append(productGroup);
      }
      const allResults = document.createElement("a");
      allResults.className = "site-header__suggestion-all";
      allResults.href = `${searchDialog.querySelector("form").action}?${new URLSearchParams({ q: query, "options[prefix]": "last" })}`;
      allResults.textContent = searchDialog.dataset.searchAll;
      layout.append(allResults);
      results.append(layout);
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };


    input?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" && !results.hidden) {
        event.preventDefault();
        results.querySelector("a")?.focus();
      }
    });
    results.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const links = Array.from(results.querySelectorAll("a"));
      const index = links.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      const nextIndex = index + (event.key === "ArrowDown" ? 1 : -1);
      if (nextIndex < 0) input.focus();
      else links[Math.min(nextIndex, links.length - 1)]?.focus();
    });

    input?.addEventListener("input", () => {
      const query = input.value.trim();
      window.clearTimeout(searchTimer);
      searchController?.abort();
      results.hidden = true;
      results.replaceChildren();
      input.setAttribute("aria-expanded", "false");
      initial.hidden = query.length >= 2;
      if (query.length < 2) return;
      const cacheKey = query.toLocaleLowerCase();
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.createdAt < 30000) { renderResults(cached.payload, query); return; }
      searchCache.delete(cacheKey);

      searchTimer = window.setTimeout(async () => {
        const controller = new AbortController();
        searchController = controller;
        const url = new URL(searchDialog.dataset.predictiveUrl, window.location.origin);
        url.search = new URLSearchParams({
          q: query,
          "resources[type]": "query,product,collection",
          "resources[limit]": "4",
          "resources[limit_scope]": "each",
          "resources[options][unavailable_products]": "hide",
        }).toString();
        try {
          const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error("predictive-search");
          const payload = await response.json();
          if (controller.signal.aborted || input.value.trim() !== query || !searchDialog.open) return;
          if (searchCache.size >= 12) searchCache.delete(searchCache.keys().next().value);
          searchCache.set(cacheKey, { payload, createdAt: Date.now() });
          renderResults(payload, query);
        } catch (error) {
          if (error.name === "AbortError") return;
          results.textContent = searchDialog.dataset.searchError;
          results.hidden = false;
          input.setAttribute("aria-expanded", "true");
        }
      }, 180);
    });
  }

  const wishlistKey = "upy-wishlist-v1";
  const wishlistDialog = document.querySelector("[data-wishlist-dialog]");
  const wishlistList = wishlistDialog?.querySelector("[data-wishlist-list]");
  const wishlistEmpty = wishlistDialog?.querySelector("[data-wishlist-empty]");
  const readWishlist = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(wishlistKey) || "[]");
      return Array.isArray(stored) ? stored.filter((item) => item && item.id) : [];
    } catch {
      return [];
    }
  };
  const updateWishlistCount = () => {
    const count = readWishlist().length;
    document.querySelectorAll("[data-wishlist-count]").forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  };
  const renderWishlist = () => {
    if (!wishlistList || !wishlistEmpty) return;
    const items = readWishlist();
    wishlistList.replaceChildren();
    wishlistEmpty.hidden = items.length > 0;
    wishlistList.hidden = items.length === 0;
    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "site-header__wishlist-item";
      const link = document.createElement("a");
      link.className = "site-header__wishlist-product";
      link.href = item.url || (item.handle ? `/products/${encodeURIComponent(item.handle)}` : "#");
      if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = "";
        image.loading = "lazy";
        link.append(image);
      }
      const copy = document.createElement("span");
      copy.textContent = item.title || "";
      link.append(copy);
      row.append(link);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "site-header__wishlist-remove";
      remove.dataset.wishlistRemove = String(item.id);
      remove.textContent = wishlistDialog.dataset.removeLabel;
      row.append(remove);
      wishlistList.append(row);
    });
  };
  wishlistList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-wishlist-remove]");
    if (!button) return;
    const nextItems = readWishlist().filter((item) => String(item.id) !== button.dataset.wishlistRemove);
    writeWishlist(nextItems);
  });
  window.addEventListener("storage", (event) => {
    if (event.key === wishlistKey) {
      updateWishlistCount();
      renderWishlist();
    }
  });
  window.addEventListener("upy:wishlist:change", () => {
    updateWishlistCount();
    renderWishlist();
  });
  updateWishlistCount();

  const writeWishlist = (items) => {
    try { window.localStorage.setItem(wishlistKey, JSON.stringify(items)); } catch { return false; }
    window.dispatchEvent(new CustomEvent("upy:wishlist:change", { detail: items }));
    return true;
  };
  window.UpyTheme = { readWishlist, writeWishlist, wishlistKey };
  const sources = document.currentScript?.dataset || {};
  const loadedFeatures = new Set();
  const loadFeature = (name, selector) => {
    if (loadedFeatures.has(name) || !sources[name] || !document.querySelector(selector)) return;
    loadedFeatures.add(name);
    const script = document.createElement("script");
    script.src = sources[name];
    script.async = true;
    script.addEventListener("error", () => loadedFeatures.delete(name), { once: true });
    document.head.append(script);
  };
  const loadPageFeatures = () => {
    loadFeature("homeScript", "[data-home-hero], [data-home-video-carousel], [data-home-categories], [data-buy-color]");
    loadFeature("cardsScript", "[data-home-launches]");
    loadFeature("recentScript", "[data-recently-viewed], [data-recent-product-id], [data-launch-product-link]");
  };
  loadPageFeatures();
  document.addEventListener("shopify:section:load", loadPageFeatures);
  try {
    if (window.sessionStorage.getItem("upy-open-cart-after-launch-add") === "true") {
      window.sessionStorage.removeItem("upy-open-cart-after-launch-add");
      document.querySelector('[data-dialog-open="cart"]')?.click();
    }
  } catch {}
})();
