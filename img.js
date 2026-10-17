/*
 * ImgVault: compress an image to WebP under a size limit, then encrypt it with a password.
 *
 *   const locked = await ImgVault.encrypt(file, 'password', 50);  // Blob, 50 KB max including encryption overhead
 *   const image  = await ImgVault.decrypt(locked, 'password');    // Blob (image/webp)
 *   img.src = URL.createObjectURL(image);
 *
 * Needs a modern browser (canvas WebP encoding + WebCrypto). No dependencies.
 * Locked format: [16 byte salt][12 byte IV][AES-GCM ciphertext + 16 byte tag]
 */
(function (root) {
  const OVERHEAD = 16 + 12 + 16;                       // salt + iv + GCM tag
  const toWebp = (canvas, q) => new Promise(r => canvas.toBlob(r, 'image/webp', q));

  // Draw on a canvas and encode as WebP: highest quality that fits, shrinking pixels only if needed.
  async function compress(img, maxBytes) {
    const bmp = await createImageBitmap(img, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    let scale = 1;
    try {
      for (let i = 0; i < 12; i++) {
        canvas.width = Math.max(1, Math.round(bmp.width * scale));
        canvas.height = Math.max(1, Math.round(bmp.height * scale));
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

        let lo = 0.6, hi = 0.92;                       // never go below 60% quality before shrinking
        let best = await toWebp(canvas, hi);
        if (!best || best.type !== 'image/webp') throw new Error('This browser cannot encode WebP.');
        if (best.size <= maxBytes) return best;

        const floor = await toWebp(canvas, lo);
        if (floor.size <= maxBytes) {
          best = floor;
          for (let k = 0; k < 7; k++) {                // binary search for the best quality that fits
            const mid = (lo + hi) / 2, b = await toWebp(canvas, mid);
            if (b.size <= maxBytes) { best = b; lo = mid; } else { hi = mid; }
          }
          return best;
        }
        scale *= Math.max(0.5, Math.min(0.95, Math.sqrt(maxBytes / floor.size) * 0.97));
        if (bmp.width * scale < 48 || bmp.height * scale < 48) break;
      }
    } finally {
      if (bmp.close) bmp.close();
    }
    throw new Error('Could not fit this image into the size limit.');
  }

  // Password + salt -> AES key (PBKDF2 makes password guessing slow).
  async function deriveKey(password, salt) {
    const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  // img: File, Blob, <img> or <canvas>. Returns a Blob you can store (IndexedDB, Dexie, upload).
  async function encrypt(img, password, maxKB = 50) {
    if (!password) throw new Error('A password is required.');
    const maxBytes = maxKB * 1024 - OVERHEAD;
    if (!(maxBytes > 0)) throw new Error('maxKB is too small.');
    const webp = await compress(img, maxBytes);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const body = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(password, salt), await webp.arrayBuffer());
    return new Blob([salt, iv, body], { type: 'application/octet-stream' });
  }

  // eimg: the Blob from encrypt() (or its ArrayBuffer / Uint8Array). Returns an image/webp Blob.
  async function decrypt(eimg, password) {
    const buf = new Uint8Array(eimg instanceof Blob ? await eimg.arrayBuffer() : eimg);
    try {
      const key = await deriveKey(password, buf.slice(0, 16));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(16, 28) }, key, buf.slice(28));
      return new Blob([plain], { type: 'image/webp' });
    } catch {
      throw new Error('Wrong password or corrupted data.');
    }
  }

  root.ImgVault = { encrypt, decrypt };
  if (typeof module !== 'undefined') module.exports = root.ImgVault;
})(typeof globalThis !== 'undefined' ? globalThis : this);
