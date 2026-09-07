/**
 * PdfExtractor.js — Extraction de texte depuis un PDF (via pdf.js).
 *
 * COUCHE : Service (appelé uniquement par un Controller).
 * DÉPENDANCE PRÉVUE : pdf.js (pdfjs-dist), chargé côté client (module/CDN).
 * RÔLE : transformer un fichier PDF en { text, pages[] } consommable par
 * DocumentModel. Aucune manipulation du DOM applicatif.
 */
export class PdfExtractor {
  /**
   * Extrait le texte d'un PDF, page par page.
   * @param {File|ArrayBuffer} file - Fichier PDF sélectionné.
   * @returns {Promise<{text:string, pages:Array<{page:number, text:string}>}>}
   *          Texte concaténé et liste des pages numérotées (1-based).
   */
  async extract(file) {
    // TODO: charger le document via pdf.js, itérer les pages, concaténer le texte.
    // TODO: retourner { text, pages: [{page:1, text:"..."}, ...] }.
  }
}
