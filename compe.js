// add this file to index.html
// create x-components with directory
// each component can have its own css, js(but not local scope)
// nesting available
/* contribute('store-name' , 
{ object piece that will contribute to Alpine.store('store-name')}
)
 usefull for components 
*/

const ran = new Set();

function contribute(name, slice) {
  if (!Alpine.store(name)) Alpine.store(name, {});
  const store = Alpine.store(name);
  Object.assign(store, slice);
  if (store.init) { store.init(); delete store.init; } // run once, then drop it
}
window.contribute = contribute;

class Component extends HTMLElement {
  async connectedCallback() {
    const src = this.getAttribute("src");
    this.innerHTML = await fetch(src).then(r => r.text());

    this.querySelectorAll("script").forEach((script, i) => {
      const key = `${src}#${i}`;
      script.remove();
      if (!ran.has(key)) {
        ran.add(key);
        new Function("Alpine", "contribute", script.textContent)(Alpine, contribute);
      }
    });

   // if (window.Alpine) Alpine.initTree(this);
  }
}
customElements.define("x-component", Component);
