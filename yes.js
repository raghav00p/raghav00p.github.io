// tiny-component.js
// <x-component src="fragment.html"></x-component>
// Fetches an HTML fragment, injects it, and runs any inline <script>
// tag inside it — exactly once per element instance.

// ---- fragment cache ---------------------------------------------------
// Several <x-component> can point at the same src at once (e.g. one
// "details.html" per task in a loop). Share one network request
// between them instead of re-fetching per instance.
const fragmentCache = new Map(); // src -> Promise<string>

function getFragment(src) {
  if (!fragmentCache.has(src)) {
    fragmentCache.set(
      src,
      fetch(src).then((r) => {
        if (!r.ok) throw new Error(`x-component: ${src} -> ${r.status}`);
        return r.text();
      })
    );
  }
  return fragmentCache.get(src);
}

// ---- shared-store contribution -----------------------------------------
// contribute(name, slice) merges `slice` into Alpine.store(name) instead
// of replacing it, so several fragments can each own a piece of the same
// store. `init()` on a slice (or on any object nested in the slice) runs
// exactly once — not once per contribute() *call*, but once per logical
// path, ever. That distinction matters now: a fragment's script can
// legitimately run several times (once per sibling instance), and each
// run builds a brand-new slice object with its own `init` function, so
// dedupe has to be keyed by name/path, not by object identity.
const initializedPaths = new Set();

function contribute(name, slice) {
  if (!Alpine.store(name)) Alpine.store(name, {});
  const store = Alpine.store(name);
  Object.assign(store, slice);

  const targets = [
    [name, store],
    ...Object.entries(slice)
      .filter(([, v]) => v && typeof v === "object")
      .map(([key, v]) => [`${name}.${key}`, v]),
  ];

  for (const [path, target] of targets) {
    if (typeof target.init === "function") {
      const init = target.init;
      delete target.init; // never leave a callable init sitting on the store
      if (!initializedPaths.has(path)) {
        initializedPaths.add(path);
        init.call(target);
      }
    }
  }
}
window.contribute = contribute;

// ---- <x-component> ------------------------------------------------------
class Component extends HTMLElement {
  async connectedCallback() {
    // connectedCallback fires every time this node is inserted into the
    // document — including when a drag-sort library (or Alpine's own
    // keyed x-for reconciliation, triggered by any store mutation) moves
    // it elsewhere in the DOM. That's a *reconnect* of the same node,
    // not a new mount: the fragment is already loaded and initialized,
    // so leave it alone. (Re-fetching + resetting innerHTML here is what
    // wiped out state/classes on reorder and lost x-cloak/css.)
    if (this._mounted) return;
    this._mounted = true;

    const src = this.getAttribute("src");
    let html;
    try {
      html = await getFragment(src);
    } catch (err) {
      console.error(err);
      this._mounted = false; // allow a retry on a future connect
      return;
    }

    // The fetch above yields to the event loop. If this element got
    // disconnected in the meantime (e.g. a parent re-render removed it
    // before the fragment arrived), don't inject into a detached node —
    // and let a later real connect try again.
    if (!this.isConnected) {
      this._mounted = false;
      return;
    }

    this.innerHTML = html;

    // innerHTML never executes <script> tags — run them ourselves, once
    // per *this* element. Not once per src: a fragment reused by several
    // siblings (one details.html per task, one subtask.html per subtask)
    // needs its script to run for every single one of them, not just
    // whichever copy happened to load first.
    this.querySelectorAll("script").forEach((script) => {
      script.remove();
      try {
        new Function("Alpine", "contribute", script.textContent)(Alpine, contribute);
      } catch (err) {
        console.error(`x-component: script failed in ${src}`, err);
      }
    });

    if (window.Alpine) Alpine.initTree(this);
  }
}
customElements.define("x-component", Component);
