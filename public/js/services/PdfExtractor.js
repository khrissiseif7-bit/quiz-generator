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
 *
 * pdf.js ne renvoie PAS toujours d'espace explicite entre les mots : il faut le
 * déduire des positions. Chaque item porte str, transform ([a,b,c,d,x,y]),
 * width et hasEOL. On procède ainsi :
 *   - fin de ligne : item.hasEOL, ou saut vertical (|Δy| > 0,5 × taille police) ;
 *   - même ligne : on mesure l'ÉCART horizontal entre les deux items ; s'il
 *     dépasse ~0,2 × taille de police, on insère une espace.
 *
 * L'écart est calculé de façon INDÉPENDANTE DU SENS de lecture :
 *   - en LTR (latin), x croît : l'écart est x_courant − (x_préc + largeur_préc) ;
 *   - en RTL (arabe), x décroît : l'écart est x_préc − (x_courant + largeur_courant).
 * On prend le maximum des deux, donc la détection marche dans les deux sens.
 *
 * @param {Array<{str:string, transform:number[], width:number, hasEOL:boolean}>} items
 * @returns {string}
 */
export function itemsVersTexte(items) {
  let out = "";
  let prec = null; // { gauche, droite, y, taille } de l'item précédent sur la ligne

  for (const it of items) {
    if (typeof it.str !== "string") {
      if (it.hasEOL) { out += "\n"; prec = null; }
      continue;
    }

    if (it.str.length > 0) {
      const t = it.transform || [1, 0, 0, 1, 0, 0];
      const x = t[4];
      const y = t[5];
      // Taille de police ≈ échelle verticale du texte.
      const taille = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || Math.abs(t[0]) || 1;
      const largeur = it.width || 0;
      const gauche = x;
      const droite = x + largeur;

      if (prec) {
        const dy = Math.abs(y - prec.y);
        if (dy > prec.taille * 0.5) {
          // Nouvelle ligne détectée par la position verticale.
          if (!/\n$/.test(out)) out += "\n";
        } else {
          // Même ligne : écart horizontal (indépendant du sens de lecture).
          const ecart = Math.max(gauche - prec.droite, prec.gauche - droite);
          const seuil = Math.max(prec.taille, taille) * 0.2;
          if (ecart > seuil && !/\s$/.test(out) && !/^\s/.test(it.str)) out += " ";
        }
      }

      out += it.str;
      prec = { gauche, droite, y, taille };
    }

    if (it.hasEOL) { out += "\n"; prec = null; }
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
