/**
 * PdfExtractor.js — Extraction de texte depuis un PDF (pdf.js, côté client).
 *
 * COUCHE : Service (appelé UNIQUEMENT par UploadController).
 * DÉPENDANCE : pdf.js est VENDORÉ dans /public/vendor/pdfjs (pdfjs-dist 4.7.76),
 * donc chargé LOCALEMENT (aucun CDN au runtime). Le worker est indiqué via
 * GlobalWorkerOptions.workerSrc. pdf.js est importé paresseusement (dynamic
 * import) pour ne le télécharger que lorsqu'un PDF est réellement utilisé.
 *
 * RÔLE : transformer un PDF en { text, pages: [{ num, text }] } avec un
 * nettoyage : recollage des mots coupés par césure, suppression des en-têtes /
 * pieds de page (lignes répétées sur plus de la moitié des pages), réduction
 * des espaces multiples. Aucune manipulation du DOM.
 */
export class PdfExtractor {
  constructor() {
    this._pdfjs = null; // module pdf.js mémorisé après premier chargement
  }

  /**
   * Charge pdf.js (une seule fois) et configure le worker.
   * @returns {Promise<object>} Le module pdf.js.
   */
  async _charger() {
    if (!this._pdfjs) {
      const pdfjs = await import("/vendor/pdfjs/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.mjs";
      this._pdfjs = pdfjs;
    }
    return this._pdfjs;
  }

  /**
   * Extrait le texte d'un PDF, page par page.
   * @param {File|ArrayBuffer} file - Fichier PDF sélectionné.
   * @param {{onProgress?:(page:number,total:number)=>void, maxPages?:number}} [opts]
   * @returns {Promise<{text:string, pages:{num:number, text:string}[]}>}
   * @throws {Error} err.code = "TOO_MANY_PAGES" si le PDF dépasse maxPages.
   */
  async extract(file, opts = {}) {
    const { onProgress, maxPages = 40 } = opts;
    const pdfjs = await this._charger();

    const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

    try {
      if (doc.numPages > maxPages) {
        const e = new Error("TOO_MANY_PAGES");
        e.code = "TOO_MANY_PAGES";
        e.pages = doc.numPages;
        throw e;
      }

      const pages = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const contenu = await page.getTextContent();
        pages.push({ num: n, text: itemsVersTexte(contenu.items) });
        page.cleanup();
        if (onProgress) onProgress(n, doc.numPages);
      }
      return { text: nettoyer(pages), pages };
    } finally {
      await doc.destroy();
    }
  }
}

/**
 * Reconstruit le texte d'une page à partir des « items » de pdf.js.
 * Chaque item porte le texte (str) et un drapeau hasEOL (fin de ligne).
 * @param {Array<{str:string, hasEOL:boolean}>} items
 * @returns {string}
 */
export function itemsVersTexte(items) {
  let out = "";
  for (const it of items) {
    if (typeof it.str === "string") out += it.str;
    if (it.hasEOL) out += "\n";
  }
  return out;
}

/**
 * Nettoie le texte extrait :
 *   1. supprime les en-têtes/pieds (lignes identiques sur > 50 % des pages) ;
 *   2. recolle les mots coupés par césure en fin de ligne ;
 *   3. réduit les espaces multiples et les lignes vides en excès.
 * @param {{num:number, text:string}[]} pages
 * @returns {string}
 */
export function nettoyer(pages) {
  const total = pages.length;

  // 1) Fréquence des lignes (comptées une fois par page où elles apparaissent).
  const frequence = new Map();
  const lignesParPage = pages.map((p) => {
    const lignes = p.text
      .split(/\r?\n/)
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean);
    for (const l of new Set(lignes)) frequence.set(l, (frequence.get(l) || 0) + 1);
    return lignes;
  });

  const enTetesPieds = new Set();
  if (total >= 2) {
    for (const [ligne, count] of frequence) {
      // Répétée sur plus de la moitié des pages ET assez courte pour être un
      // en-tête/pied (on évite de supprimer un vrai paragraphe répété).
      if (count > total / 2 && ligne.length <= 120) enTetesPieds.add(ligne);
    }
  }

  // 2) Reconstruction en retirant en-têtes/pieds.
  let texte = lignesParPage
    .map((lignes) => lignes.filter((l) => !enTetesPieds.has(l)).join("\n"))
    .join("\n");

  // 3) Recollage de la césure : « exemp-\nle » -> « exemple ».
  texte = texte.replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2");

  // 4) Espaces multiples et lignes vides en excès.
  texte = texte
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return texte;
}
