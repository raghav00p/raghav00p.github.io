/*!
 * l-sort.js — minimal, dependency-free drag & drop list sorting.
 * An HTML-directive driven replacement for common SortableJS use cases.
 *
 * USAGE
 * -----
 *   <ul l-sort="animation:150; storage:true; storageKey:my-list">
 *     <li data-id="1">Item one</li>
 *     <li data-id="2">Item two</li>
 *   </ul>
 *
 * DIRECTIVE OPTIONS  (l-sort="key:value; key2:value2")
 * -----------------------------------------------------
 *   delay        ms to hold before a drag starts (good for touch)   default 0
 *   handle       CSS selector — only this part of the item          default null (whole item)
 *                can start a drag
 *   filter       CSS selector for parts that should NOT start a     default null
 *                drag (inputs, buttons, links, ...)
 *   axis         "y" (vertical list) or "x" (horizontal row)        default "y"
 *   animation    ms duration of the re-order (FLIP) animation,      default 150
 *                0 disables it
 *   group        name shared by several [l-sort] containers to      default null
 *                allow dragging items between them
 *   ghostClass   class applied to the placeholder left in the list  default "l-ghost"
 *   dragClass    class applied to the item being dragged            default "l-drag"
 *   storage      "true" to persist the resulting order in           default false
 *                localStorage
 *   storageKey   localStorage key. Required when storage:true       default null
 *   disabled     "true" to turn sorting off entirely                default false
 *
 * PERSISTENCE
 * -----------
 * Give each item a stable `data-id="..."` attribute. On init the saved
 * order (if any) is applied; on every drop the new order is saved.
 * Without data-id, the item's current index is used as a fallback key,
 * which is fine for static lists but not recommended for lists whose
 * content changes.
 *
 * EVENTS
 * ------
 *   container.addEventListener('l-sort:end', (e) => {
 *     const { item, from, to, oldIndex, newIndex } = e.detail;
 *   });
 *
 * PUBLIC API
 * ----------
 *   LSort.init(root)        scan (root || document) for [l-sort] and mount them
 *   LSort.get(el)           get the LSort instance mounted on el, or null
 *   new LSort(el, options)  mount an element manually (options override the directive)
 *   instance.enable() / instance.disable()
 *   instance.save()         re-persist order after you add/remove items yourself
 *   instance.destroy()
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    delay: 0,
    handle: null,
    filter: null,
    axis: 'y',
    animation: 150,
    group: null,
    ghostClass: 'l-ghost',
    dragClass: 'l-drag',
    storage: false,
    storageKey: null,
    disabled: false,
  };

  // groupName -> Set<LSort instance>, powers cross-container dragging
  const GROUPS = new Map();

  // ---------- one-time base styles ----------
  // :where(...) keeps specificity at zero so any user CSS for
  // .l-ghost / .l-drag wins automatically, in any stylesheet order.
  let styleInjected = false;
  function injectBaseStyles() {
    if (styleInjected) return;
    styleInjected = true;
    const css =
      ':where([l-sort]) > * { touch-action: none; }' +
      ':where(.l-ghost) { opacity: .4; background: rgba(0,0,0,.06); border: 1px dashed rgba(0,0,0,.3); }' +
      ':where(.l-drag) { cursor: grabbing; }';
    const tag = document.createElement('style');
    tag.setAttribute('data-l-sort', '');
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // ---------- directive parsing ----------
  // l-sort="delay:300; handle:.grip; storage:true"
  function parseDirective(str) {
    const out = {};
    if (!str) return out;
    str.split(';').forEach((part) => {
      if (!part.trim()) return;
      const i = part.indexOf(':');
      if (i === -1) return;
      const rawKey = part.slice(0, i).trim();
      const rawVal = part.slice(i + 1).trim();
      const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      let val = rawVal;
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (val !== '' && !isNaN(val)) val = Number(val);
      out[key] = val;
    });
    return out;
  }

  // ---------- FLIP re-order animation ----------
  function withFlip(container, duration, mutate) {
    if (!duration) { mutate(); return; }
    const children = directChildren(container);
    const first = new Map(children.map((c) => [c, c.getBoundingClientRect()]));
    mutate();
    directChildren(container).forEach((c) => {
      const f = first.get(c);
      if (!f) return;
      const last = c.getBoundingClientRect();
      const dx = f.left - last.left;
      const dy = f.top - last.top;
      if (!dx && !dy) return;
      c.style.transition = 'none';
      c.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        c.style.transition = `transform ${duration}ms ease`;
        c.style.transform = '';
      });
      const cleanup = () => { c.style.transition = ''; c.style.transform = ''; c.removeEventListener('transitionend', cleanup); };
      c.addEventListener('transitionend', cleanup);
    });
  }

  // When several [l-sort] containers share a `group` and also use `storage`,
  // an item may have been dragged from one container into another in a past
  // session. Each container only knows how to reorder its own children, so
  // right after a batch of containers is mounted we do one pass that moves
  // any item to whichever container's saved list actually claims it.
  function reconcileGroup(name) {
    const instances = Array.from(GROUPS.get(name) || []);
    const withStorage = instances.filter((i) => i.options.storage && i.options.storageKey);
    if (withStorage.length < 2) return;

    const home = new Map(); // id -> instance that should own it
    withStorage.forEach((inst) => {
      let saved;
      try { saved = JSON.parse(localStorage.getItem(inst.options.storageKey) || 'null'); } catch (e) { saved = null; }
      if (Array.isArray(saved)) saved.forEach((id) => { if (!home.has(id)) home.set(id, inst); });
    });
    if (!home.size) return;

    instances.forEach((inst) => {
      directChildren(inst.el).forEach((child, idx) => {
        const target = home.get(inst._idOf(child, idx));
        if (target && target !== inst) target.el.appendChild(child);
      });
    });
    withStorage.forEach((inst) => inst._restoreOrder());
  }

  // Frameworks like Alpine (x-for) and Vue leave a <template> tag in the
  // DOM as a marker alongside the elements it rendered. Ignore it so it's
  // never treated as a draggable sibling.
  function directChildren(el) {
    return Array.from(el.children).filter((c) => c.tagName !== 'TEMPLATE');
  }

  let uid = 0;

  class LSort {
    constructor(el, opts) {
      if (el._lsort) return el._lsort;
      injectBaseStyles();

      this.el = el;
      this.id = ++uid;
      this.options = Object.assign({}, DEFAULTS, parseDirective(el.getAttribute('l-sort')), opts || {});
      el._lsort = this;

      this._onPointerDown = this._onPointerDown.bind(this);
      this._onDelayMove = this._onDelayMove.bind(this);
      this._onDelayUp = this._onDelayUp.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);

      el.addEventListener('pointerdown', this._onPointerDown);

      if (this.options.group) {
        if (!GROUPS.has(this.options.group)) GROUPS.set(this.options.group, new Set());
        GROUPS.get(this.options.group).add(this);
      }

      this._restoreOrder();
    }

    // ---------- public ----------
    enable() { this.options.disabled = false; }
    disable() { this.options.disabled = true; }
    // Call after you add/remove items with your own code so storage stays in sync.
    save() { this._saveOrder(); }
    destroy() {
      this.el.removeEventListener('pointerdown', this._onPointerDown);
      if (this.options.group && GROUPS.has(this.options.group)) GROUPS.get(this.options.group).delete(this);
      delete this.el._lsort;
    }

    // ---------- persistence ----------
    _idOf(item, index) {
      return item.getAttribute('data-id') || String(index);
    }
    _saveOrder() {
      const { storage, storageKey } = this.options;
      if (!storage) return;
      if (!storageKey) {
        console.warn('[l-sort] storage:true requires a storageKey — skipping persistence for', this.el);
        return;
      }
      const order = directChildren(this.el).map((c, i) => this._idOf(c, i));
      try { localStorage.setItem(storageKey, JSON.stringify(order)); } catch (e) { /* storage unavailable */ }
    }
    _restoreOrder() {
      const { storage, storageKey } = this.options;
      if (!storage || !storageKey) return;
      let saved;
      try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (e) { saved = null; }
      if (!Array.isArray(saved)) return;
      const children = directChildren(this.el);
      const byId = new Map(children.map((c, i) => [this._idOf(c, i), c]));
      const frag = document.createDocumentFragment();
      saved.forEach((id) => {
        const c = byId.get(id);
        if (c) { frag.appendChild(c); byId.delete(id); }
      });
      byId.forEach((c) => frag.appendChild(c)); // anything not in the saved order goes last
      this.el.appendChild(frag);
    }

    // ---------- helpers ----------
    _childFromEvent(e) {
      let node = e.target;
      while (node && node !== this.el) {
        if (node.parentElement === this.el) return node;
        node = node.parentElement;
      }
      return null;
    }
    _candidateContainers() {
      if (this.options.group && GROUPS.has(this.options.group)) {
        return Array.from(GROUPS.get(this.options.group)).map((i) => i.el);
      }
      return [this.sourceContainer];
    }
    _containerAt(x, y) {
      for (const c of this._candidateContainers()) {
        const r = c.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c;
      }
      return (this.ghost && this.ghost.parentElement) || this.sourceContainer;
    }

    // ---------- drag lifecycle ----------
    _onPointerDown(e) {
      if (this.options.disabled || this._dragging) return;
      if (e.button !== undefined && e.button !== 0) return;
      const item = this._childFromEvent(e);
      if (!item) return;
      if (this.options.filter && e.target.closest(this.options.filter)) return;
      if (this.options.handle && !e.target.closest(this.options.handle)) return;

      this._pending = { startX: e.clientX, startY: e.clientY };

      if (this.options.delay > 0) {
        document.addEventListener('pointermove', this._onDelayMove);
        document.addEventListener('pointerup', this._onDelayUp, { once: true });
        this._delayTimer = setTimeout(() => {
          this._clearDelayWatchers();
          this._startDrag(item, e);
        }, this.options.delay);
      } else {
        this._startDrag(item, e);
      }
    }
    _onDelayMove(e) {
      const p = this._pending;
      if (!p) return;
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 8) {
        clearTimeout(this._delayTimer);
        this._clearDelayWatchers();
      }
    }
    _onDelayUp() { clearTimeout(this._delayTimer); this._clearDelayWatchers(); }
    _clearDelayWatchers() {
      document.removeEventListener('pointermove', this._onDelayMove);
      document.removeEventListener('pointerup', this._onDelayUp);
    }

    _startDrag(item, e) {
      this._pending = null;
      this._dragging = true;
      this.sourceContainer = this.el;
      this.startIndex = directChildren(this.el).indexOf(item);

      const rect = item.getBoundingClientRect();
      this._offsetX = e.clientX - rect.left;
      this._offsetY = e.clientY - rect.top;

      this.ghost = item.cloneNode(true);
      this.ghost.classList.add(this.options.ghostClass);
      this.ghost.classList.remove(this.options.dragClass);
      this.ghost.style.width = rect.width + 'px';
      this.ghost.style.height = rect.height + 'px';
      item.after(this.ghost);

      this.currentItem = item;
      item.classList.add(this.options.dragClass);
      Object.assign(item.style, {
        position: 'fixed',
        zIndex: 9999,
        margin: '0',
        width: rect.width + 'px',
        height: rect.height + 'px',
        left: rect.left + 'px',
        top: rect.top + 'px',
        pointerEvents: 'none',
      });
      document.body.appendChild(item);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

      this.el.classList.add('l-sort-active');
      document.addEventListener('pointermove', this._onPointerMove);
      document.addEventListener('pointerup', this._onPointerUp, { once: true });
    }

    _onPointerMove(e) {
      if (!this._dragging) return;
      const item = this.currentItem;
      item.style.left = (e.clientX - this._offsetX) + 'px';
      item.style.top = (e.clientY - this._offsetY) + 'px';

      const container = this._containerAt(e.clientX, e.clientY);
      const axis = this.options.axis === 'x' ? 'x' : 'y';
      const siblings = directChildren(container).filter((c) => c !== this.ghost);

      let ref = null;
      let placeBefore = true;
      for (const sib of siblings) {
        const r = sib.getBoundingClientRect();
        const mid = axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
        const pos = axis === 'x' ? e.clientX : e.clientY;
        if (pos < mid) { ref = sib; placeBefore = true; break; }
      }
      if (!ref && siblings.length) { ref = siblings[siblings.length - 1]; placeBefore = false; }

      const doMove = () => {
        if (ref) container.insertBefore(this.ghost, placeBefore ? ref : ref.nextSibling);
        else container.appendChild(this.ghost);
      };

      if (container === this.ghost.parentElement) {
        withFlip(container, this.options.animation, doMove);
      } else {
        doMove();
      }
    }

    _onPointerUp() {
      if (!this._dragging) return;
      document.removeEventListener('pointermove', this._onPointerMove);
      this._dragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const item = this.currentItem;
      const ghost = this.ghost;
      const targetContainer = ghost.parentElement;

      Object.assign(item.style, {
        position: '', zIndex: '', margin: '', width: '', height: '', left: '', top: '', pointerEvents: '',
      });
      item.classList.remove(this.options.dragClass);
      targetContainer.insertBefore(item, ghost);
      ghost.remove();

      this.el.classList.remove('l-sort-active');

      const newIndex = directChildren(targetContainer).indexOf(item);
      const detail = { item, from: this.sourceContainer, to: targetContainer, oldIndex: this.startIndex, newIndex };
      this.sourceContainer.dispatchEvent(new CustomEvent('l-sort:end', { detail }));
      if (targetContainer !== this.sourceContainer) targetContainer.dispatchEvent(new CustomEvent('l-sort:end', { detail }));

      this._saveOrder();
      const targetInstance = targetContainer._lsort;
      if (targetInstance && targetInstance !== this) targetInstance._saveOrder();

      this.currentItem = null;
      this.ghost = null;
    }
  }

  // ---------- static API ----------
  LSort.init = function (root) {
    const scope = root || document;
    const touchedGroups = new Set();
    scope.querySelectorAll('[l-sort]').forEach((el) => {
      if (!el._lsort) {
        const inst = new LSort(el);
        if (inst.options.group) touchedGroups.add(inst.options.group);
      }
    });
    touchedGroups.forEach(reconcileGroup);
  };
  LSort.get = function (el) { return el._lsort || null; };
  LSort.defaults = DEFAULTS;

  global.LSort = LSort;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => LSort.init());
    } else {
      LSort.init();
    }

    // pick up [l-sort] containers added to the page later on (debounced —
    // a full re-scan is cheap and avoids per-node scope edge cases)
    let rescanQueued = false;
    new MutationObserver((muts) => {
      const hasElementNodes = muts.some((m) => m.addedNodes.length);
      if (!hasElementNodes || rescanQueued) return;
      rescanQueued = true;
      queueMicrotask(() => { rescanQueued = false; LSort.init(); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})(typeof window !== 'undefined' ? window : this);
