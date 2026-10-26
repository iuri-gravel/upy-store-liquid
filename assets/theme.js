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
    window.addEventListener("scroll", update, { passive: true });

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
      const summary = group.querySelector("summary");
      let closeTimer = 0;
      const setExpanded = (expanded) => {
        group.open = expanded;
        summary?.setAttribute("aria-expanded", String(expanded));
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
        summary?.focus();
      });
    });
  });

  const searchDialog = document.querySelector("[data-search-dialog]");
  if (searchDialog) {
    const input = searchDialog.querySelector("[data-predictive-search-input]");
    const results = searchDialog.querySelector("[data-search-results]");
    const initial = searchDialog.querySelector("[data-search-initial]");
    let searchTimer = 0;
    let searchController = null;

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
          image.src = imageUrl;
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
        if (item.price) {
          const price = document.createElement("span");
          price.className = "site-header__suggestion-price";
          price.textContent = item.price;
          details.append(price);
        }
        link.append(details);
      } else {
        link.textContent = item.title || "";
      }
      container.append(link);
    };

    const renderResults = (payload, query) => {
      const data = payload?.resources?.results || {};
      const products = Array.isArray(data.products) ? data.products : [];
      const collections = Array.isArray(data.collections) ? data.collections : [];
      results.replaceChildren();
      if (!products.length && !collections.length) {
        results.textContent = searchDialog.dataset.searchEmpty;
        results.hidden = false;
        input.setAttribute("aria-expanded", "true");
        return;
      }

      const layout = document.createElement("div");
      layout.className = "site-header__suggestion-layout";
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

    input?.addEventListener("input", () => {
      const query = input.value.trim();
      window.clearTimeout(searchTimer);
      searchController?.abort();
      results.hidden = true;
      results.replaceChildren();
      input.setAttribute("aria-expanded", "false");
      initial.hidden = Boolean(query);
      if (query.length < 2) return;

      searchTimer = window.setTimeout(async () => {
        searchController = new AbortController();
        const url = new URL(searchDialog.dataset.predictiveUrl, window.location.origin);
        url.search = new URLSearchParams({
          q: query,
          "resources[type]": "product,collection",
          "resources[limit]": "6",
          "resources[options][unavailable_products]": "hide",
        }).toString();
        try {
          const response = await fetch(url, { signal: searchController.signal, headers: { Accept: "application/json" } });
          if (!response.ok) throw new Error("predictive-search");
          renderResults(await response.json(), query);
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
    window.localStorage.setItem(wishlistKey, JSON.stringify(nextItems));
    window.dispatchEvent(new CustomEvent("upy:wishlist:change", { detail: nextItems }));
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

  document.querySelectorAll("[data-home-hero]").forEach((hero) => {
    const track = hero.querySelector("[data-home-hero-track]");
    const slides = Array.from(hero.querySelectorAll("[data-home-hero-slide]"));
    const dots = Array.from(hero.querySelectorAll("[data-home-hero-dot]"));
    const previous = hero.querySelector("[data-home-hero-previous]");
    const next = hero.querySelector("[data-home-hero-next]");
    const status = hero.querySelector("[data-home-hero-status]");
    if (!track || slides.length < 2) return;

    let activeIndex = 0;
    let timer = 0;
    let scrollFrame = 0;

    const setActive = (index, scroll) => {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeIndex;
        slide.toggleAttribute("inert", !active);
        slide.setAttribute("aria-hidden", String(!active));
        if (dots[slideIndex]) {
          dots[slideIndex].classList.toggle("is-active", active);
          if (active) dots[slideIndex].setAttribute("aria-current", "true");
          else dots[slideIndex].removeAttribute("aria-current");
        }
      });
      if (status) status.textContent = `${activeIndex + 1} de ${slides.length}`;
      if (scroll) {
        track.scrollTo({ left: activeIndex * track.clientWidth, behavior: reducedMotion.matches ? "auto" : "smooth" });
      }
    };

    const isPaused = () => document.hidden || reducedMotion.matches;
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const start = () => {
      stop();
      if (isPaused()) return;
      timer = window.setInterval(() => {
        if (!isPaused()) setActive(activeIndex + 1, true);
      }, Number(hero.dataset.interval) || 5000);
    };

    previous?.addEventListener("click", () => setActive(activeIndex - 1, true));
    next?.addEventListener("click", () => setActive(activeIndex + 1, true));
    dots.forEach((dot) => dot.addEventListener("click", () => setActive(Number(dot.dataset.homeHeroDot), true)));
    track.addEventListener("scroll", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        const index = Math.round(track.scrollLeft / track.clientWidth);
        if (index !== activeIndex) setActive(index, false);
      });
    }, { passive: true });
    document.addEventListener("visibilitychange", start);
    reducedMotion.addEventListener("change", start);
    setActive(0, false);
    start();
  });

  document.querySelectorAll("[data-home-video-carousel]").forEach((carousel) => {
    const track = carousel.querySelector("[data-home-video-track]");
    const cards = Array.from(carousel.querySelectorAll("[data-home-video-card]"));
    const videos = Array.from(carousel.querySelectorAll("[data-home-video-element]"));
    const previous = carousel.querySelector("[data-home-video-previous]");
    const next = carousel.querySelector("[data-home-video-next]");
    const status = carousel.closest("[data-home-video-section]")?.querySelector("[data-home-video-status]");
    if (!track || cards.length === 0) return;

    let hasUserInteracted = false;
    let scrollFrame = 0;
    const videosInView = new WeakSet();

    const shouldPlay = (video) => hasUserInteracted && videosInView.has(video) && !document.hidden && !reducedMotion.matches;
    const updateVideo = (video) => {
      if (!shouldPlay(video)) {
        video.pause();
        return;
      }

      if (video.dataset.videoLoaded !== "true") {
        const source = video.dataset.videoSrc;
        if (!source) return;
        video.src = source;
        video.dataset.videoLoaded = "true";
        video.load();
      }

      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    };
    const updateVideos = () => videos.forEach(updateVideo);

    const interactionEvents = ["pointerdown", "wheel", "touchstart", "keydown"];
    const enableVideoPlayback = () => {
      if (hasUserInteracted) return;
      hasUserInteracted = true;
      interactionEvents.forEach((eventName) => window.removeEventListener(eventName, enableVideoPlayback));
      updateVideos();
    };
    interactionEvents.forEach((eventName) => window.addEventListener(eventName, enableVideoPlayback, { once: true, passive: true }));

    if ("IntersectionObserver" in window) {
      const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videosInView.add(entry.target);
            updateVideo(entry.target);
          } else {
            videosInView.delete(entry.target);
            entry.target.pause();
          }
        });
      }, { rootMargin: "120px 0px" });
      videos.forEach((video) => videoObserver.observe(video));
    }

    const updateCarousel = () => {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const canScroll = maxScroll > 2;
      carousel.classList.toggle("has-overflow", canScroll);
      track.classList.toggle("is-centered", carousel.dataset.centerIfFits === "true" && !canScroll);
      if (previous) previous.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = maxScroll - track.scrollLeft <= 2;

      if (status) {
        const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
        const cardWidth = cards[0].getBoundingClientRect().width + gap;
        const activeIndex = cardWidth > 0 ? Math.min(cards.length - 1, Math.round(track.scrollLeft / cardWidth)) : 0;
        status.textContent = `Vídeo ${activeIndex + 1} de ${cards.length}`;
      }
    };

    const scrollByCard = (direction) => {
      const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
      const cardWidth = cards[0].getBoundingClientRect().width + gap;
      track.scrollBy({ left: direction * cardWidth, behavior: reducedMotion.matches ? "auto" : "smooth" });
    };

    previous?.addEventListener("click", () => scrollByCard(-1));
    next?.addEventListener("click", () => scrollByCard(1));
    track.addEventListener("scroll", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(updateCarousel);
    }, { passive: true });
    window.addEventListener("resize", updateCarousel, { passive: true });
    document.addEventListener("visibilitychange", updateVideos);
    reducedMotion.addEventListener("change", updateVideos);
    if ("ResizeObserver" in window) new ResizeObserver(updateCarousel).observe(track);
    updateCarousel();
  });

  const launchColorMap = {
    amarelo: "#f4d83d",
    azul: "#2b3f5f",
    "azul atena": "#2963af",
    "azul bebe": "#a8d8f0",
    "azul bic": "#1d4ed8",
    "azul claro": "#8ecae6",
    "azul marinho": "#152544",
    "azul navy": "#2b3f5f",
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
  document.querySelectorAll("[data-home-launches]").forEach((section) => {
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

    section.querySelectorAll("[data-launch-swatch-dot]").forEach((dot) => {
      dot.style.background = getLaunchColorValue(dot.dataset.colorName || "");
    });

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
        if (image) {
          const src = swatch.dataset.image760 || swatch.dataset.image1000 || swatch.dataset.image480;
          const src480 = swatch.dataset.image480;
          const src760 = swatch.dataset.image760;
          const src1000 = swatch.dataset.image1000;
          if (src) image.src = src;
          if (src480 && src760 && src1000) image.srcset = `${src480} 480w, ${src760} 760w, ${src1000} 1000w`;
          image.alt = `${card.dataset.productTitle} na cor ${displayLaunchColor(color)}`;
        }
      }

      card.querySelectorAll("[data-launch-product-link]").forEach((link) => {
        const baseUrl = link.dataset.productBaseUrl;
        if (!baseUrl) return;
        const url = new URL(baseUrl, window.location.origin);
        if (color) url.searchParams.set("cor", color);
        else url.searchParams.delete("cor");
        link.href = `${url.pathname}${url.search}${url.hash}`;
      });

      card.querySelectorAll("[data-launch-size]").forEach((button) => {
        const sizeColor = normalizeLaunchColor(button.dataset.sizeColor || "");
        button.hidden = Boolean(sizeColor && sizeColor !== normalizedColor);
      });
    };

    section.querySelectorAll("[data-launch-card]").forEach((card) => {
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
          window.localStorage.setItem(wishlistKey, JSON.stringify(nextItems));
          window.dispatchEvent(new CustomEvent("upy:wishlist:change", { detail: nextItems }));
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
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ id: Number(button.dataset.variantId), quantity: 1 }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.description || result.message || "Não foi possível adicionar este tamanho.");
            try { window.sessionStorage.setItem("upy-open-cart-after-launch-add", "true"); } catch {}
            window.location.reload();
          } catch (error) {
            button.dataset.pending = "false";
            button.disabled = false;
            if (feedback) feedback.textContent = error instanceof Error ? error.message : "Não foi possível adicionar à sacola.";
          }
        });
      });
    });

    window.addEventListener("upy:wishlist:change", updateLaunchWishlistButtons);
    window.addEventListener("storage", (event) => {
      if (event.key === wishlistKey) updateLaunchWishlistButtons();
    });
    updateLaunchWishlistButtons();
    updateCarousel();
  });

  try {
    if (window.sessionStorage.getItem("upy-open-cart-after-launch-add") === "true") {
      window.sessionStorage.removeItem("upy-open-cart-after-launch-add");
      document.querySelector('[data-dialog-open="cart"]')?.click();
    }
  } catch {}
})();

(() => {
  const initializeBuyByColor = () => {
    document.querySelectorAll("[data-buy-color]").forEach((section) => {
      const items = Array.from(section.querySelectorAll("[data-buy-color-item]"));
      const swatches = Array.from(section.querySelectorAll("[data-buy-color-swatch]"));
      if (!items.length || !swatches.length) return;

      let selectedIndex = 0;
      const desktopHover = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");

      const selectColor = (index) => {
        selectedIndex = (index + items.length) % items.length;
        items.forEach((item, itemIndex) => {
          const selected = itemIndex === selectedIndex;
          item.classList.toggle("is-selected", selected);
          if (selected) item.setAttribute("aria-current", "true");
          else item.removeAttribute("aria-current");
        });
        swatches.forEach((swatch, swatchIndex) => {
          const selected = swatchIndex === selectedIndex;
          swatch.classList.toggle("is-selected", selected);
          if (selected) swatch.setAttribute("aria-current", "true");
          else swatch.removeAttribute("aria-current");
        });
      };

      items.forEach((item, index) => {
        item.addEventListener("mouseenter", () => {
          if (desktopHover.matches) selectColor(index);
        });
      });

      swatches.forEach((swatch, index) => {
        swatch.addEventListener("mouseenter", () => {
          if (desktopHover.matches) selectColor(index);
        });
        swatch.addEventListener("focus", () => selectColor(index));
        swatch.addEventListener("keydown", (event) => {
          let nextIndex = null;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % swatches.length;
          else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index + swatches.length - 1) % swatches.length;
          else if (event.key === "Home") nextIndex = 0;
          else if (event.key === "End") nextIndex = swatches.length - 1;
          if (nextIndex === null) return;
          event.preventDefault();
          selectColor(nextIndex);
          swatches[nextIndex].focus();
        });
      });

      selectColor(0);
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeBuyByColor, { once: true });
  else initializeBuyByColor();
})();

(() => {
  const initializeCategories = () => {
    document.querySelectorAll("[data-home-categories]").forEach((section) => {
      const carousel = section.querySelector("[data-categories-carousel]");
      const viewport = section.querySelector("[data-categories-viewport]");
      const track = section.querySelector("[data-categories-track]");
      const dotsContainer = section.querySelector("[data-categories-dots]");
      const previous = section.querySelector("[data-categories-previous]");
      const next = section.querySelector("[data-categories-next]");
      if (!carousel || !viewport || !track) return;

      const slides = Array.from(track.querySelectorAll("[data-category-slide]"));
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let targets = [];
      let activeIndex = 0;
      let timer = 0;
      let isVisible = false;
      let isPaused = false;
      let isPageVisible = !document.hidden;

      const getMaxScroll = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

      const renderDots = () => {
        if (!dotsContainer) return;
        dotsContainer.replaceChildren();
        targets.forEach((_, index) => {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = "home-categories__dot";
          dot.dataset.categoriesDot = String(index);
          dot.setAttribute("aria-label", `Ir para a posição ${index + 1}`);
          dotsContainer.append(dot);
        });
      };

      const update = () => {
        const maxScroll = getMaxScroll();
        const hasOverflow = maxScroll > 2;
        carousel.classList.toggle("has-overflow", hasOverflow);
        targets = [];

        if (hasOverflow) {
          slides.forEach((slide) => {
            const target = Math.min(slide.offsetLeft, maxScroll);
            if (!targets.length || target > targets[targets.length - 1] + 1) targets.push(target);
          });
          if (targets.length && maxScroll > targets[targets.length - 1] + 1) targets.push(maxScroll);
        }

        if (dotsContainer && dotsContainer.childElementCount !== targets.length) renderDots();
        if (!targets.length) activeIndex = 0;
        else {
          activeIndex = targets.reduce((closest, target, index) =>
            Math.abs(target - viewport.scrollLeft) < Math.abs(targets[closest] - viewport.scrollLeft) ? index : closest, 0);
        }

        if (previous) previous.disabled = viewport.scrollLeft <= 2;
        if (next) next.disabled = viewport.scrollLeft >= maxScroll - 2;
        dotsContainer?.querySelectorAll("[data-categories-dot]").forEach((dot, index) => {
          if (index === activeIndex) dot.setAttribute("aria-current", "true");
          else dot.removeAttribute("aria-current");
        });
      };

      const goTo = (index, behavior = "smooth") => {
        if (!targets.length) return;
        activeIndex = Math.max(0, Math.min(index, targets.length - 1));
        viewport.scrollTo({ left: targets[activeIndex], behavior });
        update();
      };

      const scheduleAutoplay = () => {
        window.clearTimeout(timer);
        if (
          section.dataset.autoplay !== "true" || reducedMotion.matches || !isVisible ||
          !isPageVisible || isPaused || targets.length < 2
        ) return;
        const interval = Number(section.dataset.interval) || 5000;
        timer = window.setTimeout(() => {
          goTo(activeIndex >= targets.length - 1 ? 0 : activeIndex + 1);
          scheduleAutoplay();
        }, interval);
      };

      previous?.addEventListener("click", () => {
        goTo(activeIndex - 1);
        scheduleAutoplay();
      });
      next?.addEventListener("click", () => {
        goTo(activeIndex + 1);
        scheduleAutoplay();
      });
      dotsContainer?.addEventListener("click", (event) => {
        const dot = event.target.closest("[data-categories-dot]");
        if (!dot) return;
        goTo(Number(dot.dataset.categoriesDot));
        scheduleAutoplay();
      });
      viewport.addEventListener("scroll", () => window.requestAnimationFrame(update), { passive: true });
      section.addEventListener("mouseenter", () => { isPaused = true; scheduleAutoplay(); });
      section.addEventListener("mouseleave", () => { isPaused = false; scheduleAutoplay(); });
      section.addEventListener("focusin", () => { isPaused = true; scheduleAutoplay(); });
      section.addEventListener("focusout", (event) => {
        if (!section.contains(event.relatedTarget)) {
          isPaused = false;
          scheduleAutoplay();
        }
      });
      document.addEventListener("visibilitychange", () => {
        isPageVisible = !document.hidden;
        scheduleAutoplay();
      });
      reducedMotion.addEventListener?.("change", scheduleAutoplay);

      if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
          isVisible = entries[0]?.isIntersecting ?? false;
          scheduleAutoplay();
        }, { threshold: 0.3 });
        observer.observe(section);
      } else {
        isVisible = true;
      }

      if ("ResizeObserver" in window) new ResizeObserver(update).observe(viewport);
      window.addEventListener("resize", update, { passive: true });
      update();
      scheduleAutoplay();
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeCategories, { once: true });
  else initializeCategories();
})();
