(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const initializeHome = (scope = document) => {
    scope.querySelectorAll("[data-home-hero]").forEach((hero) => {
      if (hero.dataset.heroInitialized === "true") return;
      hero.dataset.heroInitialized = "true";
      const track = hero.querySelector("[data-home-hero-track]");
      const slides = Array.from(hero.querySelectorAll("[data-home-hero-slide]"));
      const dots = Array.from(hero.querySelectorAll("[data-home-hero-dot]"));
      const previous = hero.querySelector("[data-home-hero-previous]");
      const next = hero.querySelector("[data-home-hero-next]");
      const status = hero.querySelector("[data-home-hero-status]");
      if (!track || slides.length < 2) return;

      let activeIndex = 0;
      let heroVisible = true;
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

      const isPaused = () => document.hidden || reducedMotion.matches || !heroVisible;
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
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => { heroVisible = entries[0].isIntersecting; start(); }, { threshold: 0.1 }).observe(hero);
      }
      setActive(0, false);
      start();
    });

    scope.querySelectorAll("[data-home-video-carousel]").forEach((carousel) => {
      if (carousel.dataset.videoInitialized === "true") return;
      carousel.dataset.videoInitialized = "true";
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

  };
  initializeHome();
  document.addEventListener("shopify:section:load", (event) => initializeHome(event.target));
})();

(() => {
  const initializeBuyByColor = () => {
    document.querySelectorAll("[data-buy-color]").forEach((section) => {
      if (section.dataset.buyColorInitialized === "true") return;
      section.dataset.buyColorInitialized = "true";
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
  document.addEventListener("shopify:section:load", initializeBuyByColor);
})();

(() => {
  const initializeCategories = () => {
    document.querySelectorAll("[data-home-categories]").forEach((section) => {
      if (section.dataset.categoriesInitialized === "true") return;
      section.dataset.categoriesInitialized = "true";
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
      let categoriesFrame = 0;
      viewport.addEventListener("scroll", () => {
        if (categoriesFrame) return;
        categoriesFrame = window.requestAnimationFrame(() => { categoriesFrame = 0; update(); });
      }, { passive: true });
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
  document.addEventListener("shopify:section:load", initializeCategories);
})();
