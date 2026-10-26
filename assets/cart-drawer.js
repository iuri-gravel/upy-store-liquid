(() => {
  const header = document.querySelector("[data-site-header]");
  const dialog = header?.querySelector("[data-cart-dialog]");
  if (!header || !dialog) return;

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const colorMap = {
    amarelo: "#f4d83d", azul: "#2b3f5f", bege: "#d8c4a8", black: "#111111",
    branco: "#ffffff", bordo: "#722f37", cafe: "#6f4e37", caramelo: "#b87845",
    chumbo: "#4b4f54", cinza: "#b8b8b8", coral: "#d17e67", creme: "#eee1c6",
    grafite: "#4a4a4a", marinho: "#1d2c4f", marrom: "#d17e67", nude: "#d7ad91",
    offwhite: "#f3efe6", pink: "#ec4899", preta: "#111111", preto: "#111111",
    rosa: "#e94791", roxo: "#75449b", terracota: "#d8a66f", verde: "#68684d",
    vermelho: "#d32f2f", vinho: "#752f43", navy: "#2b3f5f", blue: "#2b3f5f",
    red: "#d32f2f", black: "#111111", white: "#ffffff", brown: "#8c5a3c",
  };
  const rootUrl = window.Shopify?.routes?.root || "/";
  const endpoint = (path) => `${rootUrl.replace(/\/?$/, "/")}${path}`;
  let removalRequest = null;

  const parseJsonResponse = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.description || payload.message || "Não foi possível atualizar a sacola.");
    return payload;
  };

  const showError = (message) => {
    const error = dialog.querySelector("[data-cart-error]");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  };

  const setBusy = (busy) => {
    const panel = dialog.querySelector("[data-cart-panel]");
    if (!panel) return;
    panel.setAttribute("aria-busy", String(busy));
    panel.querySelectorAll("button, input").forEach((control) => {
      if (busy) {
        if (!control.disabled) control.dataset.cartWasEnabled = "true";
        control.disabled = true;
      } else if (control.dataset.cartWasEnabled === "true") {
        control.disabled = false;
        delete control.dataset.cartWasEnabled;
      }
    });
  };

  const reopenAfterReload = () => {
    try { window.sessionStorage.setItem("upy-reopen-cart-after-update", "true"); } catch {}
    window.location.reload();
  };

  const updateCartTrigger = (renderedHeader) => {
    const count = renderedHeader?.dataset.cartItemCount;
    if (count === undefined) return;
    header.dataset.cartItemCount = count;
    const trigger = header.querySelector('[data-dialog-open="cart"]');
    if (!trigger) return;
    trigger.setAttribute("aria-label", `Abrir sacola com ${count} itens`);
    let badge = trigger.querySelector("[data-cart-count]");
    if (Number(count) > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "site-header__count";
        badge.dataset.cartCount = "";
        trigger.append(badge);
      }
      badge.textContent = count;
    } else {
      badge?.remove();
    }
  };

  const renderCartSections = (payload) => {
    const sectionId = header.dataset.cartSectionId;
    const html = sectionId ? payload.sections?.[sectionId] : null;
    if (!html) {
      reopenAfterReload();
      return true;
    }
    const documentFromSection = new DOMParser().parseFromString(html, "text/html");
    const renderedHeader = documentFromSection.querySelector("[data-site-header]");
    const renderedDialog = documentFromSection.querySelector("[data-cart-dialog]");
    if (!renderedHeader || !renderedDialog) {
      reopenAfterReload();
      return true;
    }
    updateCartTrigger(renderedHeader);
    dialog.innerHTML = renderedDialog.innerHTML;
    return true;
  };

  const sectionsPayload = () => {
    const sectionId = header.dataset.cartSectionId;
    if (!sectionId) return {};
    return {
      sections: [sectionId],
      sections_url: `${window.location.pathname}${window.location.search}`,
    };
  };

  const postCart = async (path, data) => {
    const response = await fetch(endpoint(`cart/${path}.js`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonResponse(response);
  };

  const updateLine = async (key, quantity) => {
    const payload = await postCart("change", { id: key, quantity, ...sectionsPayload() });
    renderCartSections(payload);
  };

  const getVariants = (item) => {
    try { return JSON.parse(item.querySelector("[data-cart-variants]")?.textContent || "[]"); }
    catch { return []; }
  };

  const hasEnoughStock = (variant, quantity) => Boolean(
    variant?.available && (Number(variant.stock) < 0 || Number(variant.stock) >= quantity)
  );

  const refreshQuantityLimit = (item) => {
    const quantity = Number(item.dataset.quantity) || 1;
    const stock = Number(item.dataset.currentStock);
    const plus = item.querySelector('[data-cart-quantity-change="1"]');
    if (plus) plus.disabled = item.dataset.currentAvailable === "false" || (stock >= 0 && quantity >= stock);
  };

  const findVariant = (item, color, size) => getVariants(item).find((variant) => {
    const colorMatches = !item.dataset.colorPosition || normalize(variant.color) === normalize(color);
    const sizeMatches = !item.dataset.sizePosition || normalize(variant.size) === normalize(size);
    return colorMatches && sizeMatches;
  });

  const setDraft = (item, color = item.dataset.draftColor, size = item.dataset.draftSize) => {
    item.dataset.draftColor = color || "";
    item.dataset.draftSize = size || "";
    const quantity = Number(item.dataset.quantity) || 1;
    const colors = Array.from(item.querySelectorAll("[data-cart-color]"));
    colors.forEach((button) => {
      const selected = normalize(button.dataset.value) === normalize(item.dataset.draftColor);
      button.setAttribute("aria-pressed", String(selected));
      const variants = getVariants(item).filter((variant) => normalize(variant.color) === normalize(button.dataset.value));
      const available = variants.some((variant) => hasEnoughStock(variant, quantity));
      button.disabled = !available;
      const swatch = button.querySelector("span");
      if (swatch && !swatch.dataset.swatchColor && !swatch.dataset.swatchImage) {
        const key = normalize(button.dataset.value).replace(/\s+/g, " ");
        const background = colorMap[key] || colorMap[key.split(" ")[0]] || "#d3d1cd";
        swatch.style.background = background;
      }
      if (swatch?.dataset.swatchColor) swatch.style.backgroundColor = swatch.dataset.swatchColor;
      if (swatch?.dataset.swatchImage) {
        swatch.style.backgroundImage = `url("${swatch.dataset.swatchImage}")`;
        swatch.style.backgroundSize = "cover";
      }
    });

    item.querySelectorAll("[data-cart-size]").forEach((button) => {
      const value = button.dataset.value;
      const variant = findVariant(item, item.dataset.draftColor, value);
      button.hidden = !variant;
      button.disabled = !hasEnoughStock(variant, quantity);
      button.setAttribute("aria-pressed", String(normalize(value) === normalize(item.dataset.draftSize)));
    });

    const colorLabel = item.querySelector("[data-cart-draft-color-label]");
    if (colorLabel) colorLabel.textContent = item.dataset.draftColor;
    const selected = findVariant(item, item.dataset.draftColor, item.dataset.draftSize);
    const save = item.querySelector("[data-cart-edit-save]");
    if (save) save.disabled = !hasEnoughStock(selected, quantity) || String(selected?.id) === item.dataset.currentVariantId;
  };

  const readProperties = (item) => {
    try {
      const value = JSON.parse(item.querySelector("[data-cart-line-properties]")?.textContent || "{}");
      return value && typeof value === "object" ? value : {};
    } catch { return {}; }
  };

  const stableProperties = (properties) => JSON.stringify(
    Object.fromEntries(Object.entries(properties || {}).sort(([a], [b]) => a.localeCompare(b)))
  );

  const findCartLine = (cart, item, variantId, properties, sellingPlan) => {
    const exactKey = cart.items.find((line) => line.key === item.dataset.lineKey && String(line.variant_id) === String(variantId));
    if (exactKey) return exactKey;
    return cart.items.find((line) =>
      String(line.variant_id) === String(variantId) &&
      stableProperties(line.properties) === stableProperties(properties) &&
      String(line.selling_plan_allocation?.selling_plan?.id || "") === String(sellingPlan || "")
    );
  };

  const saveVariant = async (item) => {
    const quantity = Number(item.dataset.quantity) || 1;
    const selected = findVariant(item, item.dataset.draftColor, item.dataset.draftSize);
    if (!hasEnoughStock(selected, quantity)) {
      showError("Essa combinação está indisponível para a quantidade escolhida.");
      return;
    }
    if (String(selected.id) === item.dataset.currentVariantId) {
      item.querySelector("[data-cart-editor]").hidden = true;
      item.querySelector("[data-cart-edit-toggle]")?.setAttribute("aria-expanded", "false");
      return;
    }

    setBusy(true);
    const properties = readProperties(item);
    const sellingPlan = item.dataset.sellingPlanId;
    let didAdd = false;
    try {
      const addData = { id: Number(selected.id), quantity, properties };
      if (sellingPlan) addData.selling_plan = Number(sellingPlan);
      await postCart("add", addData);
      didAdd = true;

      const cartResponse = await fetch(endpoint("cart.js"), { headers: { Accept: "application/json" } });
      const cart = await parseJsonResponse(cartResponse);
      const oldLine = findCartLine(cart, item, item.dataset.currentVariantId, properties, sellingPlan);
      if (!oldLine) throw new Error("Não localizei a opção anterior para concluir a troca. Atualize a página e confira sua sacola.");

      const result = await postCart("change", { id: oldLine.key, quantity: 0, ...sectionsPayload() });
      renderCartSections(result);
    } catch (error) {
      if (didAdd) {
        try {
          const cartResponse = await fetch(endpoint("cart.js"), { headers: { Accept: "application/json" } });
          const cart = await parseJsonResponse(cartResponse);
          const addedLine = findCartLine(cart, item, selected.id, properties, sellingPlan);
          if (!addedLine) throw new Error("Não foi possível reverter a nova opção.");
          const rollbackQuantity = Math.max(0, Number(addedLine.quantity) - quantity);
          await postCart("change", { id: addedLine.key, quantity: rollbackQuantity });
        } catch {
          reopenAfterReload();
          return;
        }
      }
      setBusy(false);
      showError(error instanceof Error ? error.message : "Não foi possível trocar a cor ou o tamanho.");
    }
  };

  const showRemoveDialog = (item, trigger) => {
    removalRequest = { item, trigger };
    const overlay = dialog.querySelector("[data-cart-remove-dialog]");
    const description = dialog.querySelector("[data-cart-remove-description]");
    if (!overlay) return;
    description.textContent = `Deseja remover ${item.querySelector(".site-header__cart-item-title")?.textContent?.trim() || "este produto"} da sacola?`;
    overlay.hidden = false;
    overlay.querySelector("[data-cart-remove-cancel]")?.focus();
  };

  const closeRemoveDialog = () => {
    const trigger = removalRequest?.trigger;
    const overlay = dialog.querySelector("[data-cart-remove-dialog]");
    if (overlay) overlay.hidden = true;
    removalRequest = null;
    trigger?.focus();
  };

  dialog.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-dialog-close]")) {
      if (dialog.open) dialog.close();
      return;
    }
    const item = target.closest("[data-cart-item]");

    const removeLink = target.closest("[data-cart-remove]");
    if (removeLink && item) {
      event.preventDefault();
      showRemoveDialog(item, removeLink);
      return;
    }
    if (target.closest("[data-cart-remove-cancel]")) {
      closeRemoveDialog();
      return;
    }
    if (target.closest("[data-cart-remove-dialog]") === target) {
      closeRemoveDialog();
      return;
    }
    if (target.closest("[data-cart-remove-confirm]") && removalRequest) {
      const key = removalRequest.item.dataset.lineKey;
      setBusy(true);
      try {
        await updateLine(key, 0);
        removalRequest = null;
      } catch (error) {
        setBusy(false);
        closeRemoveDialog();
        showError(error instanceof Error ? error.message : "Não foi possível remover este produto.");
      }
      return;
    }
    if (!item) return;

    const quantityButton = target.closest("[data-cart-quantity-change]");
    if (quantityButton) {
      const input = item.querySelector("[data-cart-quantity]");
      const quantity = Math.max(0, (Number(input?.value) || 0) + Number(quantityButton.dataset.cartQuantityChange));
      if (input) input.value = String(quantity);
      setBusy(true);
      try { await updateLine(item.dataset.lineKey, quantity); }
      catch (error) {
        setBusy(false);
        showError(error instanceof Error ? error.message : "Não foi possível atualizar a quantidade.");
      }
      return;
    }

    if (target.closest("[data-cart-edit-toggle]")) {
      const toggle = item.querySelector("[data-cart-edit-toggle]");
      const editor = item.querySelector("[data-cart-editor]");
      const opening = editor.hidden;
      editor.hidden = !opening;
      toggle.setAttribute("aria-expanded", String(opening));
      if (opening) setDraft(item, item.dataset.currentColor, item.dataset.currentSize);
      return;
    }
    if (target.closest("[data-cart-edit-cancel]")) {
      item.querySelector("[data-cart-editor]").hidden = true;
      item.querySelector("[data-cart-edit-toggle]")?.setAttribute("aria-expanded", "false");
      setDraft(item, item.dataset.currentColor, item.dataset.currentSize);
      return;
    }
    if (target.closest("[data-cart-color]")) {
      const color = target.closest("[data-cart-color]").dataset.value;
      const currentSize = item.dataset.draftSize;
      const variants = getVariants(item).filter((variant) => normalize(variant.color) === normalize(color) && hasEnoughStock(variant, Number(item.dataset.quantity) || 1));
      const keptSize = variants.find((variant) => normalize(variant.size) === normalize(currentSize))?.size;
      setDraft(item, color, keptSize ?? variants[0]?.size ?? "");
      return;
    }
    if (target.closest("[data-cart-size]")) {
      setDraft(item, item.dataset.draftColor, target.closest("[data-cart-size]").dataset.value);
      return;
    }
    if (target.closest("[data-cart-edit-save]")) {
      await saveVariant(item);
    }
  });

  dialog.addEventListener("change", async (event) => {
    const input = event.target instanceof HTMLInputElement && event.target.matches("[data-cart-quantity]") ? event.target : null;
    if (!input) return;
    const item = input.closest("[data-cart-item]");
    const quantity = Math.max(0, Math.floor(Number(input.value) || 0));
    input.value = String(quantity);
    setBusy(true);
    try { await updateLine(item.dataset.lineKey, quantity); }
    catch (error) {
      setBusy(false);
      showError(error instanceof Error ? error.message : "Não foi possível atualizar a quantidade.");
    }
  });

  dialog.addEventListener("cancel", (event) => {
    if (!removalRequest) return;
    event.preventDefault();
    closeRemoveDialog();
  });

  dialog.querySelectorAll("[data-cart-item]").forEach((item) => {
    refreshQuantityLimit(item);
    if (item.querySelector("[data-cart-editor]")) setDraft(item, item.dataset.currentColor, item.dataset.currentSize);
  });

  try {
    if (window.sessionStorage.getItem("upy-reopen-cart-after-update") === "true") {
      window.sessionStorage.removeItem("upy-reopen-cart-after-update");
      window.setTimeout(() => header.querySelector('[data-dialog-open="cart"]')?.click(), 0);
    }
  } catch {}
})();
