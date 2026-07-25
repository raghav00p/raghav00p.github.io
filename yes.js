// tiny-component.js
// <x-component src="fragment.html"></x-component>
// Fetches an HTML fragment, injects it, and runs any inline <script>
// tag inside it — exactly once per src, ever.

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
// path, ever.
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

// ---- restricted fragment-script API -------------------------------------
// A fragment's <script> is only allowed to call three things:
//   contribute(name, slice)  — merge a slice into a shared store
//   Alpine.data(name, fn)    — register a reusable x-data factory
//   Alpine.bind(name, fn)    — register a reusable x-bind directive set
// All three are *name-keyed registries*, not per-instance side effects:
// registering twice under the same name is redundant, not meaningful.
// So the script itself only needs to run once per src, ever — no matter
// how many <x-component> instances share that src. Per-instance behavior
// still happens per instance, because Alpine.initTree(this) below is what
// actually invokes an x-data factory for a given element, and that still
// runs on every connect.
const AlpineRestricted = {
  data: Alpine.data.bind(Alpine),
  bind: Alpine.bind.bind(Alpine),
};

// NOTE: this is an API-surface convention, not a sandbox. Shadowing
// `Alpine` and `contribute` as the only two arguments keeps fragment
// authors on the three-function contract, but the function body still
// closes over the real global scope (window, document, fetch, ...) —
// `new Function` can't prevent that. If untrusted fragments are ever a
// concern, this needs a real sandbox (iframe + postMessage) or a
// build-time lint that rejects any top-level statement that isn't a
// contribute(...), Alpine.data(...), or Alpine.bind(...) call.
const executedFragments = new Set(); // src whose script has already run

function runFragmentScript(root, src) {
  const scripts = root.querySelectorAll("script");
  if (executedFragments.has(src)) {
    // Duplicate instance of an already-executed src: strip the script
    // tags (innerHTML never runs them anyway) and stop — registering
    // Alpine.data/Alpine.bind/contribute again would be pure waste.
    scripts.forEach((s) => s.remove());
    return;
  }
  executedFragments.add(src);
  scripts.forEach((script) => {
    script.remove();
    try {
      new Function("Alpine", "contribute", script.textContent)(
        AlpineRestricted,
        contribute
      );
    } catch (err) {
      console.error(`x-component: script failed in ${src}`, err);
      // Let a future connect (e.g. after a fix + reload) try again.
      executedFragments.delete(src);
    }
  });
}

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

    // innerHTML never executes <script> tags. Run it ourselves — but
    // only once per src, ever (see runFragmentScript above). Every
    // instance still needs Alpine.initTree() below so its own x-data
    // binding actually instantiates.
    runFragmentScript(this, src);

    if (window.Alpine) Alpine.initTree(this);
  }
}
customElements.define("x-component", Component);
