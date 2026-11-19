(() => {
  const initializeDiscounts = (root) => {
    if (root.dataset.discountsInitialized === "true" || root.dataset.enabled !== "true") return;
    const preview = root.dataset.preview === "true" || new URLSearchParams(window.location.search).get("bf-preview") === "1";
    const startsAt = Date.parse(root.dataset.startAt || "");
    const endsAt = Date.parse(root.dataset.endAt || "");
    const now = Date.now();
    const clock = root.querySelector("[data-black-friday-clock]");
    const clockStartsAt = Date.parse(root.dataset.clockStartAt || "");
    if (clock && (preview || now >= clockStartsAt)) clock.hidden = false;
    if (!preview && !(now >= startsAt && now < endsAt)) return;
    root.dataset.discountsInitialized = "true";

    const getDiscountStage = (count) => Math.min(4, Math.max(0, Math.floor(Number(count)) || 0));
    const cartCard = root.querySelector("[data-black-friday-cart-card]");

    if (cartCard) {
      const updateCartDiscount = () => {
        const header = document.querySelector("[data-site-header]");
        const slot = header?.querySelector("[data-black-friday-cart-slot]");
        if (!root.isConnected || !slot) return;

        const stage = getDiscountStage(header.dataset.cartItemCount);
        const card = cartCard.content.cloneNode(true);
        const rate = card.querySelector("[data-cart-discount-rate]");
        const message = card.querySelector("[data-cart-discount-message]");
        rate.textContent = stage === 0 ? rate.dataset.maximum : rate.dataset.current.replace("[discount]", `${stage * 5}%`);
        if (stage === 0) {
          message.textContent = message.dataset.first;
        } else if (stage < 4) {
          message.textContent = message.dataset.next.replace("[discount]", `${(stage + 1) * 5}%`);
        } else {
          message.textContent = message.dataset.maxReached;
        }
        card.querySelectorAll("[data-cart-discount-tier]").forEach((item) => {
          const tier = Number(item.dataset.cartDiscountTier);
          item.classList.toggle("is-reached", tier <= stage);
          if (tier === stage) item.setAttribute("aria-current", "step");
        });
        slot.replaceChildren(card);
      };

      updateCartDiscount();
      document.addEventListener("upy:cart:change", updateCartDiscount);
      document.addEventListener("shopify:section:load", updateCartDiscount);
    }

    const coupon = root.querySelector("[data-black-friday-coupon]");
    if (coupon) {
      coupon.hidden = false;
      const couponBackdrop = root.querySelector("[data-black-friday-coupon-backdrop]");
      const cartProgress = coupon.querySelector("[data-black-friday-cart-progress]");
      const closeCoupon = () => {
        coupon.open = false;
        coupon.querySelector("summary")?.focus();
      };
      const updateCouponProgress = (itemCount) => {
        if (!cartProgress) return;
        const count = Math.max(0, Number(itemCount) || 0);
        const stage = getDiscountStage(count);
        const stageName = ["zero", "one", "two", "three", "four"][stage];
        const progressBar = cartProgress.querySelector("[data-black-friday-progress]");
        const progressFill = cartProgress.querySelector("[data-black-friday-progress-fill]");
        const cartCount = cartProgress.querySelector("[data-black-friday-cart-count]");
        const stageMessage = cartProgress.querySelector("[data-black-friday-stage-message]");

        cartProgress.dataset.itemCount = String(count);
        if (cartCount) {
          const unit = count === 1 ? cartProgress.dataset.itemOne : cartProgress.dataset.itemOther;
          cartCount.textContent = `${count} ${unit}`;
        }
        if (progressBar) {
          progressBar.setAttribute("aria-valuenow", String(stage));
          progressBar.setAttribute("aria-valuetext", `${stage} ${cartProgress.dataset.progressSteps}`);
        }
        if (progressFill) progressFill.style.width = `${stage * 25}%`;
        if (stageMessage) {
          const stageKey = `stage${stageName[0].toUpperCase()}${stageName.slice(1)}`;
          stageMessage.textContent = cartProgress.dataset[stageKey] || "";
        }

        coupon.querySelectorAll("[data-black-friday-tier]").forEach((tier) => {
          const isCurrent = stage > 0 && Number(tier.dataset.blackFridayTier) === stage;
          tier.classList.toggle("is-current", isCurrent);
          if (isCurrent) tier.setAttribute("aria-current", "step");
          else tier.removeAttribute("aria-current");
        });
      };

      updateCouponProgress(cartProgress?.dataset.itemCount);
      document.addEventListener("upy:cart:change", (event) => {
        updateCouponProgress(event.detail?.itemCount);
      });
      coupon.addEventListener("toggle", () => {
        if (couponBackdrop) couponBackdrop.hidden = !coupon.open;
      });
      coupon.querySelector("[data-black-friday-coupon-close]")?.addEventListener("click", closeCoupon);
      couponBackdrop?.addEventListener("click", closeCoupon);
      document.addEventListener("click", (event) => {
        if (coupon.open && !coupon.contains(event.target)) coupon.open = false;
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && coupon.open) closeCoupon();
      });
    }

  };

  const initializeSections = () => document.querySelectorAll("[data-black-friday-discounts]").forEach(initializeDiscounts);
  initializeSections();
  document.addEventListener("shopify:section:load", initializeSections);
})();
