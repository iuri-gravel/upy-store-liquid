(() => {
  const scriptId = "sizebay-vfr-v4";
  let observer;
  let retryTimer;

  const loadSizebay = (attempt = 0) => {
    if (!document.getElementById("sizebay-container") || document.getElementById(scriptId)) return;
    if (!window.ShopifyAnalytics?.meta?.product?.id) {
      if (attempt < 20) retryTimer = window.setTimeout(() => loadSizebay(attempt + 1), 250);
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://static.sizebay.technology/8192/prescript.js";
    document.head.append(script);
  };

  const observeSizebay = () => {
    observer?.disconnect();
    window.clearTimeout(retryTimer);
    const container = document.getElementById("sizebay-container");
    if (!container || document.getElementById(scriptId)) return;
    if (!("IntersectionObserver" in window)) {
      loadSizebay();
      return;
    }

    observer = new IntersectionObserver((entries, currentObserver) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.target.isConnected)) return;
      currentObserver.disconnect();
      loadSizebay();
    }, { rootMargin: "200px 0px" });
    observer.observe(container);
  };

  observeSizebay();
  if (window.Shopify?.designMode) document.addEventListener("shopify:section:load", observeSizebay);
})();
