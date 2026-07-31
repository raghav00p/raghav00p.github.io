

const fragmentCache = new Map();  
                                    
const registered = new Set();      

function getFragment(src) {
  if (!fragmentCache.has(src)) {
    fragmentCache.set(src, fetch(src).then((r) => {
      if (!r.ok) throw new Error(`x-component: ${src} -> ${r.status}`);
      return r.text();
    }));
  }
  return fragmentCache.get(src);
}

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
    if (this._mounted) return;
    this._mounted = true;

    const src = this.getAttribute("src");
    let html;
    try {
      html = await getFragment(src);
    } catch (err) {
      console.error(err);
      this._mounted = false; 
      return;
    }
    if (!this.isConnected) { this._mounted = false; return; }

    this.innerHTML = html;

    const scripts = [];
    this.querySelectorAll("script").forEach((s) => {
      scripts.push(s.textContent);
      s.remove();
    });
    
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
