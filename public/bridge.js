/*
 * RFEDI Delivery — iframe bridge
 * Injected at render-time into every uploaded HTML.
 * Talks to the parent app via postMessage (origin-agnostic; sandbox
 * is `allow-scripts` only, so this iframe has an opaque origin).
 *
 * Messages received from parent:
 *   { type: 'SET_PINS', pins: Pin[] }
 *   { type: 'SET_MODE', mode: 'view' | 'comment' | 'edit' }
 *   { type: 'SCROLL_TO_PIN', pinId: string }
 *   { type: 'REQUEST_SAVE' }
 *   { type: 'SAVE_RESULT', ok: boolean, error?: string, newVersion?: number }
 *
 * Messages sent to parent:
 *   { type: 'READY', documentVersion: number }
 *   { type: 'PIN_CREATE', anchor: AnchorPayload }
 *   { type: 'PIN_CLICK', pinId: string }
 *   { type: 'EDIT_SAVE', html: string }
 *   { type: 'EDIT_DIRTY', dirty: boolean }
 */

(function () {
  "use strict";

  var STYLE_ID = "__rfedi_bridge_styles";
  var LAYER_ID = "__rfedi_pins_layer";
  var EDIT_TOOLBAR_ID = "__rfedi_edit_toolbar";
  var INSERTER_MENU_ID = "__rfedi_inserter_menu";
  var INSERTER_CLASS = "__rfedi_inserter";
  var BLOCK_ATTR = "data-rfedi-block";
  var BLOCK_ACTIVE_ATTR = "data-rfedi-block-active";

  var EDITABLE_TAGS = {
    p: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1,
    ul: 1, ol: 1, blockquote: 1, pre: 1, hr: 1, figure: 1, table: 1, div: 1,
  };
  var CONTAINER_TAGS = {
    body: 1, main: 1, section: 1, article: 1, aside: 1,
    header: 1, footer: 1, div: 1,
  };

  var meta = (typeof window.__deliverable === "object" && window.__deliverable) || {
    id: null,
    version: 1,
  };

  // ---------------------------------------------------------------
  // Styles for pins + comment-mode cursor + edit-mode UI
  // ---------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      'body[data-rfedi-mode="comment"], body[data-rfedi-mode="comment"] *:not(#__rfedi_pins_layer):not(#__rfedi_pins_layer *) {' +
      "cursor: crosshair !important;" +
      "}" +
      "#__rfedi_pins_layer {" +
      "position: absolute; top: 0; left: 0; width: 100%;" +
      "pointer-events: none;" +
      "z-index: 2147483646;" +
      "}" +
      ".__rfedi_pin {" +
      "position: absolute; transform: translate(-50%, -50%);" +
      "width: 28px; height: 28px; border-radius: 9999px;" +
      "background: #e51568; color: #fff;" +
      "font: 600 13px/1 -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;" +
      "display: grid; place-items: center;" +
      "box-shadow: 0 4px 12px rgba(229,21,104,0.45), 0 0 0 3px #fff;" +
      "pointer-events: auto; cursor: pointer;" +
      "transition: transform 120ms ease;" +
      "}" +
      ".__rfedi_pin:hover { transform: translate(-50%, -50%) scale(1.15); }" +
      ".__rfedi_pin.stale { background: #f59e0b; box-shadow: 0 4px 12px rgba(245,158,11,0.45), 0 0 0 3px #fff; }" +
      ".__rfedi_pin.orphan { background: #94a3b8; box-shadow: 0 4px 12px rgba(148,163,184,0.4), 0 0 0 3px #fff; }" +
      ".__rfedi_pin.resolved { background: #10b981; opacity: 0.7; box-shadow: 0 4px 12px rgba(16,185,129,0.4), 0 0 0 3px #fff; }" +
      ".__rfedi_pin.active { transform: translate(-50%, -50%) scale(1.25); }" +
      // --- edit mode ---
      'body[data-rfedi-mode="edit"] a { pointer-events: none !important; }' +
      'body[data-rfedi-mode="edit"] [data-rfedi-block] {' +
      "outline: 1px dashed transparent; outline-offset: 2px;" +
      "transition: outline-color 120ms ease;" +
      "}" +
      'body[data-rfedi-mode="edit"] [data-rfedi-block]:hover {' +
      "outline-color: rgba(229,21,104,0.4);" +
      "}" +
      // When hovering a nested block, only the innermost block keeps the outline
      'body[data-rfedi-mode="edit"] [data-rfedi-block]:hover:has([data-rfedi-block]:hover) {' +
      "outline-color: transparent;" +
      "}" +
      'body[data-rfedi-mode="edit"] [data-rfedi-block-active="1"] {' +
      "outline: 2px solid #e51568; outline-offset: 2px;" +
      "}" +
      'body[data-rfedi-mode="edit"] [contenteditable="true"] { cursor: text; }' +
      "#" + EDIT_TOOLBAR_ID + " {" +
      "position: absolute; z-index: 2147483647;" +
      "display: flex; gap: 2px; padding: 4px;" +
      "background: #0f172a; color: #fff;" +
      "border-radius: 8px;" +
      "box-shadow: 0 8px 24px rgba(0,0,0,0.25);" +
      "font: 600 13px/1 -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;" +
      "user-select: none;" +
      "}" +
      "#" + EDIT_TOOLBAR_ID + " button {" +
      "all: unset; cursor: pointer; padding: 6px 8px;" +
      "border-radius: 4px; min-width: 24px; text-align: center;" +
      "color: #fff;" +
      "}" +
      "#" + EDIT_TOOLBAR_ID + " button:hover { background: rgba(255,255,255,0.15); }" +
      "#" + EDIT_TOOLBAR_ID + ' button[data-act="del"]:hover { background: #ef4444; }' +
      "." + INSERTER_CLASS + " {" +
      "position: relative; height: 16px; margin: -8px 0;" +
      "display: flex; align-items: center; justify-content: center;" +
      "opacity: 0; transition: opacity 120ms ease;" +
      "cursor: pointer; pointer-events: auto; z-index: 2147483645;" +
      "}" +
      "." + INSERTER_CLASS + ":hover { opacity: 1; }" +
      "." + INSERTER_CLASS + "::before {" +
      'content: ""; position: absolute; left: 0; right: 0; top: 50%;' +
      "height: 1px; background: rgba(229,21,104,0.5);" +
      "}" +
      "." + INSERTER_CLASS + " > span {" +
      "position: relative; width: 20px; height: 20px;" +
      "background: #e51568; color: #fff; border-radius: 9999px;" +
      "display: grid; place-items: center;" +
      "font: 700 14px/1 -apple-system, sans-serif;" +
      "box-shadow: 0 2px 6px rgba(229,21,104,0.4);" +
      "}" +
      "#" + INSERTER_MENU_ID + " {" +
      "position: absolute; z-index: 2147483647;" +
      "background: #0f172a; color: #fff;" +
      "border-radius: 8px; padding: 4px;" +
      "box-shadow: 0 8px 24px rgba(0,0,0,0.25);" +
      "display: flex; flex-direction: column; gap: 2px; min-width: 140px;" +
      "font: 500 13px/1.2 -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;" +
      "}" +
      "#" + INSERTER_MENU_ID + " button {" +
      "all: unset; cursor: pointer; padding: 8px 10px;" +
      "border-radius: 4px; color: #fff; text-align: left;" +
      "}" +
      "#" + INSERTER_MENU_ID + " button:hover { background: rgba(255,255,255,0.15); }" +
      "";
    document.head.appendChild(s);
  }

  function getLayer() {
    var layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      // place inside body so it follows page scroll naturally
      document.body.appendChild(layer);
    }
    return layer;
  }

  // ---------------------------------------------------------------
  // CSS selector path for an element. Stable enough for our purposes.
  // ---------------------------------------------------------------
  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    if (el === document.body) return "body";
    var path = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && path.length < 12) {
      var sel = cur.tagName.toLowerCase();
      if (cur.id) {
        // ids are unique → terminate here
        sel = "#" + CSS.escape(cur.id);
        path.unshift(sel);
        return path.join(">");
      }
      var parent = cur.parentNode;
      if (parent) {
        var sameTag = 0;
        var index = 0;
        for (var i = 0; i < parent.children.length; i++) {
          var sib = parent.children[i];
          if (sib.tagName === cur.tagName) {
            sameTag++;
            if (sib === cur) index = sameTag;
          }
        }
        if (sameTag > 1) sel += ":nth-of-type(" + index + ")";
      }
      path.unshift(sel);
      cur = cur.parentElement;
    }
    path.unshift("body");
    return path.join(">");
  }

  // ---------------------------------------------------------------
  // Anchor resolution
  // ---------------------------------------------------------------
  function normalize(s) {
    return (s || "").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function similarity(a, b) {
    // cheap Jaccard-ish on word tokens
    if (!a || !b) return 0;
    var sa = a.split(/\s+/);
    var sb = b.split(/\s+/);
    var set = {};
    var inter = 0;
    for (var i = 0; i < sb.length; i++) set[sb[i]] = true;
    for (var j = 0; j < sa.length; j++) if (set[sa[j]]) inter++;
    return inter / Math.max(sa.length, sb.length);
  }

  // Returns { kind: 'pinned'|'stale'|'orphan', x, y } in PAGE coords
  function resolvePin(p) {
    var doc = document.documentElement;
    var bodyW = Math.max(doc.scrollWidth, document.body.scrollWidth, 1);
    var bodyH = Math.max(doc.scrollHeight, document.body.scrollHeight, 1);

    if (p.selectorPath) {
      try {
        var el = document.querySelector(p.selectorPath);
        if (el) {
          var rect = el.getBoundingClientRect();
          var pageX = rect.left + window.scrollX + rect.width * (p.offsetXPct || 0);
          var pageY = rect.top + window.scrollY + rect.height * (p.offsetYPct || 0);
          var text = normalize(el.textContent || "");
          var anchorText = normalize(p.anchorText || "");
          var sim = anchorText ? similarity(text, anchorText) : 1;
          return {
            kind: sim >= 0.5 ? "pinned" : "stale",
            x: pageX,
            y: pageY,
            element: el,
          };
        }
      } catch {
        // invalid selector → fall through
      }
    }

    // Fallback to coordinate %.
    if (typeof p.fallbackXPct === "number" && typeof p.fallbackYPct === "number") {
      return {
        kind: "orphan",
        x: p.fallbackXPct * bodyW,
        y: p.fallbackYPct * bodyH,
        element: null,
      };
    }

    return null;
  }

  // ---------------------------------------------------------------
  // Render pins
  // ---------------------------------------------------------------
  var currentPins = [];
  function renderPins() {
    var layer = getLayer();
    layer.innerHTML = "";

    var doc = document.documentElement;
    layer.style.height = Math.max(doc.scrollHeight, document.body.scrollHeight) + "px";

    var visibleCount = 0;
    for (var i = 0; i < currentPins.length; i++) {
      var p = currentPins[i];
      var r = resolvePin(p);
      if (!r) continue;
      visibleCount++;
      var pin = document.createElement("div");
      pin.className =
        "__rfedi_pin" +
        (r.kind === "stale" ? " stale" : "") +
        (r.kind === "orphan" ? " orphan" : "") +
        (p.status === "RESOLVED" ? " resolved" : "");
      pin.style.left = r.x + "px";
      pin.style.top = r.y + "px";
      pin.dataset.pinId = p.id;
      pin.textContent = String(p.number != null ? p.number : visibleCount);
      pin.title =
        p.title ||
        (r.kind === "stale"
          ? "El contenido cambió — pin podría no estar en su sitio"
          : r.kind === "orphan"
          ? "El elemento original ya no existe"
          : "");
      pin.addEventListener("click", function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        post({ type: "PIN_CLICK", pinId: ev.currentTarget.dataset.pinId });
      });
      layer.appendChild(pin);
    }
  }

  // ---------------------------------------------------------------
  // Click-to-create-pin (in comment mode) / activate block (in edit mode)
  // ---------------------------------------------------------------
  function onClick(e) {
    var mode = document.body.dataset.rfediMode;
    var t = e.target;

    if (mode === "edit") {
      // block any <a> click while editing
      if (t && t.closest && t.closest("a")) {
        e.preventDefault();
        e.stopPropagation();
      }
      // ignore clicks on our own UI
      if (t && t.closest && (
        t.closest("#" + EDIT_TOOLBAR_ID) ||
        t.closest("#" + INSERTER_MENU_ID) ||
        t.closest("." + INSERTER_CLASS)
      )) {
        return;
      }
      var block = t && t.closest ? t.closest("[" + BLOCK_ATTR + "]") : null;
      if (block) {
        activateBlock(block);
      } else {
        deactivateBlock();
        hideInserterMenu();
      }
      return;
    }

    if (mode !== "comment") return;

    // ignore clicks on pin layer
    if (t && t.closest && t.closest("#" + LAYER_ID)) return;

    e.preventDefault();
    e.stopPropagation();

    var el = t instanceof Element ? t : null;
    if (!el) return;

    var rect = el.getBoundingClientRect();
    var offsetXPct = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
    var offsetYPct = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;

    var doc = document.documentElement;
    var bodyW = Math.max(doc.scrollWidth, document.body.scrollWidth, 1);
    var bodyH = Math.max(doc.scrollHeight, document.body.scrollHeight, 1);
    var pageX = e.clientX + window.scrollX;
    var pageY = e.clientY + window.scrollY;

    post({
      type: "PIN_CREATE",
      anchor: {
        selectorPath: cssPath(el),
        offsetXPct: offsetXPct,
        offsetYPct: offsetYPct,
        anchorText: normalize(el.textContent || ""),
        fallbackXPct: pageX / bodyW,
        fallbackYPct: pageY / bodyH,
        documentVersion: meta.version || 1,
        viewportX: e.clientX,
        viewportY: e.clientY,
      },
    });
  }

  // ===============================================================
  // EDIT MODE
  // ===============================================================
  var isEditMode = false;
  var activeBlock = null;
  var dirty = false;
  var dirtyTimer = null;

  function setDirty(v) {
    if (dirty === v) return;
    dirty = v;
    if (dirtyTimer) clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(function () {
      post({ type: "EDIT_DIRTY", dirty: dirty });
    }, 150);
  }

  function isMarkableTag(el) {
    return !!EDITABLE_TAGS[el.tagName.toLowerCase()];
  }
  function isContainerTag(el) {
    return !!CONTAINER_TAGS[el.tagName.toLowerCase()];
  }
  function isRfediNode(el) {
    if (!el) return false;
    if (el.id && el.id.indexOf("__rfedi_") === 0) return true;
    if (el.classList && el.classList.contains(INSERTER_CLASS)) return true;
    if (el.dataset && el.dataset.rfediInjected === "1") return true;
    return false;
  }

  function markEditableBlocks() {
    function walk(node) {
      if (!node || node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "noscript" || tag === "head") return;
      if (isRfediNode(node)) return;

      var parent = node.parentElement;
      var parentOk =
        parent === document.body ||
        (parent && isContainerTag(parent) && !isRfediNode(parent));
      var marked = false;
      if (parentOk && isMarkableTag(node) && node !== document.body) {
        try {
          var cs = window.getComputedStyle(node);
          if (cs && cs.display === "none") return;
        } catch {}
        node.setAttribute(BLOCK_ATTR, "1");
        marked = true;
      }
      // For divs (containers), keep descending so nested blocks are reachable.
      // For other markable tags (p, h1-6, ul, …), stop — they don't nest.
      if (marked && tag !== "div") return;
      for (var i = 0; i < node.children.length; i++) walk(node.children[i]);
    }
    for (var i = 0; i < document.body.children.length; i++) {
      walk(document.body.children[i]);
    }
  }

  function unmarkEditableBlocks() {
    var nodes = document.querySelectorAll("[" + BLOCK_ATTR + "]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].removeAttribute(BLOCK_ATTR);
      nodes[i].removeAttribute(BLOCK_ACTIVE_ATTR);
      nodes[i].removeAttribute("contenteditable");
    }
  }

  function activateBlock(block) {
    if (activeBlock === block) {
      positionEditToolbar(block);
      return;
    }
    deactivateBlock();
    activeBlock = block;
    block.setAttribute(BLOCK_ACTIVE_ATTR, "1");
    block.setAttribute("contenteditable", "true");
    block.focus({ preventScroll: true });
    showEditToolbar(block);
  }

  function deactivateBlock() {
    if (!activeBlock) return;
    activeBlock.removeAttribute(BLOCK_ACTIVE_ATTR);
    activeBlock.removeAttribute("contenteditable");
    activeBlock = null;
    removeEditToolbar();
  }

  function createEditToolbar() {
    var bar = document.createElement("div");
    bar.id = EDIT_TOOLBAR_ID;
    bar.innerHTML =
      '<button data-act="up" title="Mover arriba">↑</button>' +
      '<button data-act="down" title="Mover abajo">↓</button>' +
      '<button data-act="dup" title="Duplicar">⎘</button>' +
      '<button data-act="del" title="Eliminar">🗑</button>';
    bar.addEventListener("mousedown", function (e) {
      // prevent toolbar click from blurring contenteditable
      e.preventDefault();
    });
    bar.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("button");
      if (!btn || !activeBlock) return;
      e.stopPropagation();
      var act = btn.dataset.act;
      var b = activeBlock;
      if (act === "up") {
        if (b.previousElementSibling && !isRfediNode(b.previousElementSibling)) {
          b.parentNode.insertBefore(b, b.previousElementSibling);
          setDirty(true);
          renderInserters();
          positionEditToolbar(b);
        }
      } else if (act === "down") {
        var next = b.nextElementSibling;
        // skip past inserter nodes
        while (next && isRfediNode(next)) next = next.nextElementSibling;
        if (next) {
          b.parentNode.insertBefore(next, b);
          setDirty(true);
          renderInserters();
          positionEditToolbar(b);
        }
      } else if (act === "dup") {
        var clone = b.cloneNode(true);
        clone.removeAttribute(BLOCK_ACTIVE_ATTR);
        clone.removeAttribute("contenteditable");
        b.parentNode.insertBefore(clone, b.nextSibling);
        setDirty(true);
        renderInserters();
        positionEditToolbar(b);
      } else if (act === "del") {
        if (!window.confirm("¿Eliminar este bloque?")) return;
        var parent = b.parentNode;
        parent.removeChild(b);
        deactivateBlock();
        setDirty(true);
        renderInserters();
      }
    });
    return bar;
  }

  function showEditToolbar(targetEl) {
    var bar = document.getElementById(EDIT_TOOLBAR_ID) || createEditToolbar();
    if (!bar.parentNode) document.body.appendChild(bar);
    positionEditToolbar(targetEl);
  }

  function positionEditToolbar(targetEl) {
    var bar = document.getElementById(EDIT_TOOLBAR_ID);
    if (!bar || !targetEl) return;
    var rect = targetEl.getBoundingClientRect();
    // Need toolbar height — make it visible to measure
    bar.style.visibility = "hidden";
    bar.style.left = "0px";
    bar.style.top = "0px";
    var barH = bar.offsetHeight || 32;
    var left = rect.left + window.scrollX;
    var top = rect.top + window.scrollY - barH - 6;
    if (top < window.scrollY + 4) {
      // not enough room above — place below
      top = rect.bottom + window.scrollY + 6;
    }
    bar.style.left = left + "px";
    bar.style.top = top + "px";
    bar.style.visibility = "visible";
  }

  function removeEditToolbar() {
    var bar = document.getElementById(EDIT_TOOLBAR_ID);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  // --- inserters ---
  function isLastBlockInParent(b) {
    var sib = b.nextElementSibling;
    while (sib) {
      if (sib.hasAttribute(BLOCK_ATTR)) return false;
      sib = sib.nextElementSibling;
    }
    return true;
  }

  function renderInserters() {
    removeInserters();
    var blocks = document.querySelectorAll("[" + BLOCK_ATTR + "]");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var before = makeInserter(b, "before");
      b.parentNode.insertBefore(before, b);
      if (isLastBlockInParent(b)) {
        var after = makeInserter(b, "after");
        b.parentNode.insertBefore(after, b.nextSibling);
      }
    }
  }

  function makeInserter(refBlock, position) {
    var el = document.createElement("div");
    el.className = INSERTER_CLASS;
    el.contentEditable = "false";
    el.innerHTML = "<span>+</span>";
    el.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      showInserterMenu(el, refBlock, position);
    });
    return el;
  }

  function removeInserters() {
    var nodes = document.querySelectorAll("." + INSERTER_CLASS);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].parentNode.removeChild(nodes[i]);
    }
  }

  function hideInserterMenu() {
    var m = document.getElementById(INSERTER_MENU_ID);
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }

  function showInserterMenu(anchorEl, refBlock, position) {
    hideInserterMenu();
    var menu = document.createElement("div");
    menu.id = INSERTER_MENU_ID;
    menu.innerHTML =
      '<button data-kind="p">Párrafo</button>' +
      '<button data-kind="h2">Encabezado</button>' +
      '<button data-kind="ul">Lista</button>' +
      '<button data-kind="hr">Separador</button>';
    menu.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    menu.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("button");
      if (!btn) return;
      e.stopPropagation();
      insertBlock(btn.dataset.kind, refBlock, position);
      hideInserterMenu();
    });
    document.body.appendChild(menu);
    var rect = anchorEl.getBoundingClientRect();
    menu.style.left = rect.left + window.scrollX + "px";
    menu.style.top = rect.bottom + window.scrollY + 4 + "px";
  }

  function insertBlock(kind, refBlock, position) {
    var el;
    if (kind === "p") {
      el = document.createElement("p");
      el.textContent = "Texto nuevo";
    } else if (kind === "h2") {
      el = document.createElement("h2");
      el.textContent = "Nuevo encabezado";
    } else if (kind === "ul") {
      el = document.createElement("ul");
      el.innerHTML = "<li>Elemento</li>";
    } else if (kind === "hr") {
      el = document.createElement("hr");
    } else {
      return;
    }
    var anchor = position === "before" ? refBlock : refBlock.nextSibling;
    refBlock.parentNode.insertBefore(el, anchor);
    el.setAttribute(BLOCK_ATTR, "1");
    setDirty(true);
    renderInserters();
    if (kind !== "hr") activateBlock(el);
  }

  // --- listeners ---
  function onInput(e) {
    if (!isEditMode) return;
    var t = e.target;
    if (t && t.closest && t.closest("[" + BLOCK_ATTR + "]")) {
      setDirty(true);
    }
  }

  function onPaste(e) {
    if (!isEditMode) return;
    var t = e.target;
    if (!t || !t.closest || !t.closest("[" + BLOCK_ATTR + "]")) return;
    e.preventDefault();
    var text = "";
    if (e.clipboardData) text = e.clipboardData.getData("text/plain");
    if (text) document.execCommand("insertText", false, text);
  }

  function onDrop(e) {
    if (!isEditMode) return;
    e.preventDefault();
  }

  function onKeydown(e) {
    if (!isEditMode) return;
    if (e.key === "Escape") {
      deactivateBlock();
      hideInserterMenu();
    }
  }

  function onScrollResize() {
    if (isEditMode && activeBlock) positionEditToolbar(activeBlock);
    scheduleRender();
  }

  function enterEditMode() {
    if (isEditMode) return;
    isEditMode = true;
    document.body.dataset.rfediMode = "edit";
    var layer = document.getElementById(LAYER_ID);
    if (layer) layer.style.display = "none";
    markEditableBlocks();
    renderInserters();
  }

  function exitEditMode() {
    if (!isEditMode) return;
    deactivateBlock();
    hideInserterMenu();
    removeInserters();
    unmarkEditableBlocks();
    isEditMode = false;
    setDirty(false);
    document.body.dataset.rfediMode = "view";
    var layer = document.getElementById(LAYER_ID);
    if (layer) layer.style.display = "";
    scheduleRender();
  }

  // ---------------------------------------------------------------
  // serializeClean — return current document HTML without bridge artifacts
  // ---------------------------------------------------------------
  function serializeClean() {
    var clone = document.documentElement.cloneNode(true);

    // Remove injected styles
    var styleEl = clone.querySelector("#" + STYLE_ID);
    if (styleEl) styleEl.remove();
    // Remove pins layer
    var layerEl = clone.querySelector("#" + LAYER_ID);
    if (layerEl) layerEl.remove();
    // Remove edit UI
    var tb = clone.querySelector("#" + EDIT_TOOLBAR_ID);
    if (tb) tb.remove();
    var im = clone.querySelector("#" + INSERTER_MENU_ID);
    if (im) im.remove();
    var inserters = clone.querySelectorAll("." + INSERTER_CLASS);
    for (var i = 0; i < inserters.length; i++) inserters[i].remove();
    // Remove scripts injected by the render proxy
    var injected = clone.querySelectorAll("script[data-rfedi-injected]");
    for (var j = 0; j < injected.length; j++) injected[j].remove();
    // Remove edit-mode attributes
    var marked = clone.querySelectorAll("[" + BLOCK_ATTR + "]");
    for (var k = 0; k < marked.length; k++) {
      marked[k].removeAttribute(BLOCK_ATTR);
      marked[k].removeAttribute(BLOCK_ACTIVE_ATTR);
      marked[k].removeAttribute("contenteditable");
    }
    // Strip rfediMode dataset on the cloned body
    var body = clone.querySelector("body");
    if (body && body.hasAttribute("data-rfedi-mode")) {
      body.removeAttribute("data-rfedi-mode");
    }

    // Recompose <html>…</html>
    var attrs = "";
    for (var a = 0; a < clone.attributes.length; a++) {
      var at = clone.attributes[a];
      attrs += " " + at.name + '="' + String(at.value).replace(/"/g, "&quot;") + '"';
    }
    return "<!doctype html>\n<html" + attrs + ">" + clone.innerHTML + "</html>";
  }

  // ---------------------------------------------------------------
  // postMessage wiring
  // ---------------------------------------------------------------
  function post(msg) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        Object.assign({ source: "rfedi-bridge", deliverableId: meta.id }, msg),
        "*",
      );
    }
  }

  function onMessage(ev) {
    var data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.source && data.source !== "rfedi-parent") return;

    switch (data.type) {
      case "SET_PINS":
        currentPins = Array.isArray(data.pins) ? data.pins : [];
        scheduleRender();
        break;
      case "SET_MODE":
        if (data.mode === "edit") {
          enterEditMode();
        } else if (data.mode === "comment") {
          if (isEditMode) exitEditMode();
          document.body.dataset.rfediMode = "comment";
        } else {
          if (isEditMode) exitEditMode();
          document.body.dataset.rfediMode = "view";
        }
        break;
      case "SCROLL_TO_PIN":
        var p = currentPins.find(function (x) {
          return x.id === data.pinId;
        });
        if (p) {
          var r = resolvePin(p);
          if (r) {
            window.scrollTo({
              top: Math.max(0, r.y - window.innerHeight / 2),
              behavior: "smooth",
            });
            highlightPin(data.pinId);
          }
        }
        break;
      case "REQUEST_SAVE":
        try {
          var html = serializeClean();
          post({ type: "EDIT_SAVE", html: html });
        } catch (err) {
          post({
            type: "EDIT_SAVE",
            html: "",
            error: err && err.message ? err.message : "serialize-failed",
          });
        }
        break;
      case "SAVE_RESULT":
        if (data.ok) setDirty(false);
        break;
    }
  }

  function highlightPin(pinId) {
    var nodes = document.querySelectorAll(".__rfedi_pin");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove("active");
      if (nodes[i].dataset.pinId === pinId) nodes[i].classList.add("active");
    }
  }

  // ---------------------------------------------------------------
  // Render scheduling — wait for layout to stabilize
  // ---------------------------------------------------------------
  var rafScheduled = false;
  function scheduleRender() {
    if (rafScheduled) return;
    rafScheduled = true;
    var fn = function () {
      rafScheduled = false;
      if (!isEditMode) renderPins();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(fn, { timeout: 300 });
    } else {
      requestAnimationFrame(fn);
    }
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  function boot() {
    injectStyles();
    document.body.dataset.rfediMode = "view";
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("dragover", onDrop, true);
    document.addEventListener("keydown", onKeydown, true);
    window.addEventListener("message", onMessage);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    // Reposition on load events (lazy images, etc.)
    window.addEventListener("load", scheduleRender);

    post({ type: "READY", documentVersion: meta.version || 1 });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
