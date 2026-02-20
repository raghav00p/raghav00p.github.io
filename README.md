# web tutorials
## [1. pwa](https://raghav00p.github.io)
## [2. flashcards](https://raghav00p.github.io/flashcards.html)

### Deploying the PWA 🚀
This repository hosts a simple Progressive Web App (PWA) at the root path. To deploy it so people can install and use it from a browser:

1. **GitHub Pages** (the quickest way):
   * Push your code to the `main` branch of a repository named `username.github.io` (this repo already qualifies).
   * Github automatically serves the site at `https://username.github.io/` (replace `username` with `raghav00p`).
   * The service worker (`service-worker.js`) and `manifest.json` are already configured; ensure they are referenced in your HTML so the PWA installs correctly.  
   * You can test locally with a simple HTTP server:  
     ```
     python3 -m http.server 8000
     ```
   * Once changes are pushed, the updated PWA will be live within minutes.

2. **Alternative hosts**: Any static hosting (Netlify, Vercel, Firebase Hosting, etc.) works—just upload the contents of this repo and point a custom domain if needed.

3. **Testing**: Open Chrome/Edge devtools → **Application** tab to inspect the manifest and service worker. Use Lighthouse to audit the PWA installation experience.

4. **Offline behavior**: The included `service-worker.js` should cache assets; verify by switching the network to "Offline" in devtools.

---

shortcut
```bash
python3 -m http.server 8000
```
