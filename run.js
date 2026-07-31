// tiny-component.js
// <x-component src="fragment.html"></x-component>
//
// Fragments are Alpine citizens, not custom-element instances.
//
// A fragment's <script> REGISTERS reusable behaviour — an
// Alpine.data() factory, and/or a slice contributed to a shared
// Alpine.store() — exactly once, globally, no matter how many copies
// of that fragment exist on the page at once (one details.html per
// task, one subtask.html per subtask, etc). That's a definition, not
// a per-instance side effect, same as defining a class once and
// `new`-ing it many times.
//
// The fragment's own markup then wires ITSELF up with a plain
// x-data="thatFactory()" — Alpine creates a fresh reactive scope and
// runs init() for every element that declares it, automatically,
// with zero help from us. This is exactly the toggle()/mood() pattern
// already in use elsewhere in the app — we're just making it the only
// pattern, instead of hand-rolling a second, worse version of it here.

const fragmentCache = new Map();   // src -> Promise<string>, shared
                                    // across every instance of a src
const registered = new Set();      // src -> its <script> has run, once, ever

function getFragment(src) {
  if (!fragmentCache.has(src)) {
    fragmentCache.set(src, fetch(src).then((r) => {
      if (!r.ok) throw new Error(`x-component: ${src} -> ${r.status}`);
      return r.text();
    }));
  }
  return fragmentCache.get(src);
}

// contribute(name, slice): merge a slice into a shared Alpine.store
// instead of replacing it — Alpine.store(name, obj) called a second
// time just overwrites the first, which silently drops whatever an
// earlier fragment already put there. Because the calling script now
// only ever runs once per src (see below), slice.init() only ever
// runs once too — no extra bookkeeping needed for that anymore.
function contribute(name, slice) {
  if (!Alpine.store(name)) Alpine.store(name, {});
  const store = Alpine.store(name);
  Object.assign(store, slice);
  if (typeof store.init === "function") {
    const init = store.init;
    delete store.init;
    init.call(store);
  }
}
window.contribute = contribute;

class Component extends HTMLElement {
  async connectedCallback() {
    // connectedCallback also fires on a *reconnect* — e.g. this node
    // getting physically moved by a drag-sort. By that point Alpine's
    // own x-data scopes inside this subtree already own all live
    // state; re-touching innerHTML here would tear that down for no
    // reason (and did, before). Render once per element, ever.
    if (this._mounted) return;
    this._mounted = true;

    const src = this.getAttribute("src");
    let html;
    try {
      html = await getFragment(src);
    } catch (err) {
      console.error(err);
      this._mounted = false; // allow a retry on a genuine future connect
      return;
    }
    if (!this.isConnected) { this._mounted = false; return; }

    this.innerHTML = html;

    const scripts = [];
    this.querySelectorAll("script").forEach((s) => {
      scripts.push(s.textContent);
      s.remove();
    });

    // Run the fragment's registration code once, globally. Every
    // sibling still gets the markup above; they just all reference
    // the one Alpine.data() factory / store slice the first copy
    // registered, exactly like calling the same class constructor
    // from multiple places.
    if (!registered.has(src)) {
      registered.add(src);
      for (const code of scripts) {
        try {
          new Function("Alpine", "contribute", code)(Alpine, contribute);
        } catch (err) {
          registered.delete(src);
          console.error(`x-component: script failed in ${src}`, err);
        }
      }
    }

    if (window.Alpine) Alpine.initTree(this);
  }
}
customElements.define("x-component", Component);
