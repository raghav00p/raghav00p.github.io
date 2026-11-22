# web tutorials
## [1. pwa](https://raghav00p.github.io)
## [2. flashcards](https://raghav00p.github.io/flashcards.html)
## [3. inspector](https://raghav00p.github.io/inspector.html)
## [4. chat](https://raghav00p.github.io/chat.html)



### Deploying the PWA 🚀
This repository hosts a Progressive Web App at the root path. The app is installable from supported browsers when the manifest and service worker are correctly wired up in the page.

1. **GitHub Pages** (the quickest way):
   * Push your code to the `main` branch of a repository named `username.github.io` (this repo already qualifies).
   * GitHub automatically serves the site at `https://username.github.io/` (replace `username` with `raghav00p`).
   * The app includes a manifest file and a registered service worker so browsers can prompt for installation.
   * You can test locally with:
     ```bash
     python3 -m http.server 8000
     ```
   * Open the site over `http://localhost:8000` or your GitHub Pages URL, then use the browser install prompt or the address bar install button.

2. **Alternative hosts**: Any static hosting (Netlify, Vercel, Firebase Hosting, etc.) works—upload the repo contents and point a custom domain if needed.

3. **PWA checklist**:
   * `index.html` references `./manifest.json` and registers `./service-worker.js`.
   * `manifest.json` defines a standalone app with an icon set and a valid `start_url`/`scope`.
   * The page is served over HTTPS or `localhost`, which is required for service workers.

4. **Testing**: Open Chrome/Edge DevTools → **Application** tab to inspect the manifest and service worker. Use Lighthouse to audit the installability and offline behavior.

5. **Offline behavior**: The app caches core assets in `service-worker.js`; verify by switching the network to "Offline" in DevTools.

---

Shortcut
```bash
python3 -m http.server 8000
```
