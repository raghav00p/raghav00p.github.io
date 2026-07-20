const ran = new Set();
let seq = 0;

function contribute(name, slice) {
  if (!Alpine.store(name)) Alpine.store(name, {});
  const store = Alpine.store(name);
  Object.assign(store, slice);
  if (store.init) { store.init(); delete store.init; }
}
window.contribute = contribute;

class Component extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute("src");
    this.innerHTML = await fetch(src).then(r => r.text());

    const instanceId = this.dataset.xid ||= `x${seq++}`; // unique per element

    this.querySelectorAll("script").forEach((script, i) => {
      const key = `${instanceId}#${i}`; // was `${src}#${i}`
      script.remove();
      if (!ran.has(key)) {
        ran.add(key);
        try {
          new Function("Alpine", "contribute", script.textContent)(Alpine, contribute);
        } catch (err) {
          ran.delete(key); // don't permanently blacklist on failure
          console.error(`x-component script failed [${src}]:`, err);
        }
      }
    });

   // if (window.Alpine) Alpine.initTree(this);
  }
}
customElements.define("x-component", Component);
