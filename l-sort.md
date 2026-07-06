# l-sort

A minimal, dependency-free drag-and-drop sorting library. One HTML attribute
turns any container into a sortable list — no build step, no config object,
no SortableJS.

```html
<script src="l-sort.js"></script>

<ul l-sort="animation:150; storage:true; storageKey:my-list">
  <li data-id="1">Item one</li>
  <li data-id="2">Item two</li>
  <li data-id="3">Item three</li>
</ul>
```

That's the whole setup. `l-sort.js` scans the page on load (and watches for
content added later) and wires up every `[l-sort]` element it finds.

Open **demo.html** in a browser for a live example: a 3-column kanban board
(drag cards between columns, order persists) and a plain reading list.

## The directive

Everything is configured through the `l-sort` attribute as `key:value` pairs
separated by `;`:

| Key          | Type              | Default     | What it does |
|--------------|-------------------|-------------|---------------|
| `delay`      | ms                | `0`         | Hold time before a drag starts. Useful on touch so a tap-to-scroll isn't mistaken for a drag. |
| `handle`     | CSS selector      | `null`      | Only this part of the item can start a drag (e.g. `.grip`). Omit to make the whole item draggable. |
| `filter`     | CSS selector      | `null`      | Parts that should **never** start a drag (buttons, inputs, links). |
| `axis`       | `y` \| `x`        | `y`         | Vertical list or horizontal row. |
| `animation`  | ms                | `150`       | Duration of the FLIP re-order animation. `0` disables it. |
| `group`      | string            | `null`      | Give several containers the same `group` name to allow dragging items between them (kanban columns). |
| `ghostClass` | class name        | `l-ghost`   | Class on the placeholder left behind in the list. |
| `dragClass`  | class name        | `l-drag`    | Class on the element actually following the pointer. |
| `storage`    | `true` \| `false` | `false`     | Persist the resulting order to `localStorage`. |
| `storageKey` | string            | `null`      | localStorage key. **Required** if `storage:true`. |
| `disabled`   | `true` \| `false` | `false`     | Turn sorting off. |

Booleans and numbers are parsed automatically — you write `delay:300`, not
`delay:"300"`.

## Styling the ghost and the dragged element

By default the library injects a bare-bones style for `.l-ghost` and
`.l-drag` using `:where()`, so it has zero specificity and any CSS you write
for those classes wins automatically:

```css
.l-ghost {
  opacity: .5;
  border: 1px dashed #999;
}
.l-drag {
  box-shadow: 0 10px 20px rgba(0,0,0,.2);
  transform: rotate(-2deg);
}
```

Use custom class names per list via `ghostClass:` / `dragClass:` if you have
several differently-styled lists on one page (see the kanban board in
demo.html, which uses `card-ghost` / `card-drag`).

## Persisting order

Give each item a stable `data-id="…"` attribute:

```html
<ul l-sort="storage:true; storageKey:todos">
  <li data-id="buy-milk">Buy milk</li>
  <li data-id="walk-dog">Walk the dog</li>
</ul>
```

On load, any saved order for `storageKey` is applied. On every drop, the new
order is saved automatically. Without `data-id`, the item's index is used as
a fallback key — fine for static content, not recommended once items can be
added, removed, or reordered from your own code (in which case call
`instance.save()` after your change, see below).

If several containers share a `group` **and** all use `storage`, dragging an
item from one container to another is remembered too: on the next load the
library moves the item back into whichever container's saved list actually
claims it, then restores each container's saved order.

## JavaScript API

```js
// re-scan the page (called automatically on load / DOM mutations)
LSort.init();
LSort.init(someContainerElement);

// get the instance mounted on a container
const instance = LSort.get(document.querySelector('ul'));

instance.enable();
instance.disable();
instance.save();     // re-persist order after you add/remove items yourself
instance.destroy();  // remove listeners, unmount

// manual mount with options that override the directive
new LSort(el, { animation: 0 });
```

## Events

```js
list.addEventListener('l-sort:end', (e) => {
  const { item, from, to, oldIndex, newIndex } = e.detail;
  // item:      the moved element
  // from / to: source / destination containers (may be the same)
  // oldIndex / newIndex: positions before and after the drop
});
```

## How it works, briefly

- Pointer Events (`pointerdown` / `pointermove` / `pointerup`) drive the
  whole thing — mouse, touch, and pen all work the same way.
- On drag start, the real item is pulled out of the flow (`position: fixed`)
  and follows the pointer; a clone with `ghostClass` is left in its place to
  reserve the slot and show where it will land.
- Moving over other items reorders the ghost among them; a small FLIP
  animation smooths the shift.
- On drop, the real item is inserted at the ghost's position and the ghost
  is discarded.

## Browser support

Anything with Pointer Events (all evergreen browsers). No polyfills, no
dependencies, ~7 KB unminified.

## Known limitations (kept deliberately out of scope for "minimal")

- Nested sortable lists (a sortable item that itself contains another
  sortable list) aren't specially handled.
- No virtual-list / windowing support for very large lists.
- Cross-container persistence (see above) only kicks in once at page load
  for containers sharing a `group`; it isn't re-checked continuously.
