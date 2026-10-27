(() => {
  const initializeCookiePreferences = () => {
    const dialog = document.querySelector("[data-cookie-preferences-dialog]");
    const banner = document.querySelector("[data-cookie-banner]");
    if (!dialog) return;

    const status = dialog.querySelector("[data-cookie-preferences-status]");
    const controls = Array.from(dialog.querySelectorAll("[data-cookie-preference]"));
    let privacyApiPromise;

    const loadPrivacyApi = () => {
      if (window.Shopify?.customerPrivacy) return Promise.resolve(window.Shopify.customerPrivacy);
      if (privacyApiPromise) return privacyApiPromise;

      privacyApiPromise = new Promise((resolve, reject) => {
        if (!window.Shopify?.loadFeatures) {
          reject(new Error("Customer Privacy API is unavailable."));
          return;
        }

        window.Shopify.loadFeatures(
          [{ name: "consent-tracking-api", version: "0.2" }],
          (error) => {
            if (error || !window.Shopify.customerPrivacy) {
              reject(error || new Error("Customer Privacy API is unavailable."));
              return;
            }
            resolve(window.Shopify.customerPrivacy);
          },
        );
      });

      return privacyApiPromise;
    };

    const showError = () => {
      if (status) status.textContent = dialog.dataset.errorMessage || "";
    };

    const updateBannerVisibility = (privacy) => {
      if (!banner) return;

      try {
        banner.hidden = typeof privacy.shouldShowBanner !== "function" || !privacy.shouldShowBanner();
      } catch {
        banner.hidden = true;
      }
    };

    const openPreferences = async () => {
      if (!dialog.open) dialog.showModal();
      if (status) status.textContent = "";

      try {
        const privacy = await loadPrivacyApi();
        const consent = privacy.currentVisitorConsent();
        controls.forEach((control) => {
          control.checked = consent[control.dataset.cookiePreference] === "yes";
        });
      } catch {
        showError();
      }
    };

    const savePreferences = async (allowOptional) => {
      if (status) status.textContent = "";

      try {
        const privacy = await loadPrivacyApi();
        const consent = Object.fromEntries(
          controls.map((control) => [
            control.dataset.cookiePreference,
            allowOptional && control.checked,
          ]),
        );

        privacy.setTrackingConsent(consent, (result) => {
          if (result?.error) {
            showError();
            return;
          }

          if (status) status.textContent = dialog.dataset.savedMessage || "";
          if (banner) banner.hidden = true;
          if (dialog.open) window.setTimeout(() => dialog.close(), 500);
        });
      } catch {
        showError();
      }
    };

    document.querySelectorAll("[data-cookie-preferences-open]").forEach((button) => {
      button.addEventListener("click", openPreferences);
    });

    banner?.querySelector("[data-cookie-banner-accept]")?.addEventListener("click", () => {
      controls.forEach((control) => { control.checked = true; });
      savePreferences(true);
    });
    banner?.querySelector("[data-cookie-banner-reject]")?.addEventListener("click", () => {
      controls.forEach((control) => { control.checked = false; });
      savePreferences(false);
    });

    dialog.querySelector("[data-cookie-preferences-close]")?.addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-cookie-preferences-save]")?.addEventListener("click", () => savePreferences(true));
    dialog.querySelector("[data-cookie-preferences-reject]")?.addEventListener("click", () => {
      controls.forEach((control) => { control.checked = false; });
      savePreferences(false);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    if (banner) {
      banner.hidden = true;
      loadPrivacyApi().then(updateBannerVisibility).catch(() => {
        banner.hidden = true;
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCookiePreferences, { once: true });
  } else {
    initializeCookiePreferences();
  }
})();
