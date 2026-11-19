/*
 * geva-export.js — Remplissage du formulaire officiel GEVA-Sco « Réexamen » (v2, déc. 2014)
 *
 * Le PDF officiel contient un formulaire AcroForm de 187 champs. Plutôt que d'imiter
 * sa mise en page, on remplit directement ces champs : le rendu est donc identique
 * au document papier.
 *
 * Dépend de pdf-lib (variable globale PDFLib dans le navigateur, copie embarquée en Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/pdf-lib.min.js'));
  else root.GevaExport = factory(root.PDFLib);
})(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  'use strict';
  const { PDFDocument, StandardFonts, PDFName, PDFTextField, layoutMultilineText, layoutSinglelineText } = PDFLib;

  // Boutons d'interface Acrobat présents en haut de la page 1 : inutiles à l'impression.
  const UI_BUTTONS = ['telecharcher-acrobat-reader', 'reset', 'imprimer'];

  // Taille de police visée, puis réduction progressive si le texte déborde du cadre.
  const PREFERRED = 9;         // zones de texte multilignes
  const PREFERRED_SINGLE = 8;  // lignes simples (même gabarit que les libellés du formulaire)
  const MIN = 6;
  const STEP = 0.5;

  // Remplacements typographiques pour les caractères absents de l'encodage WinAnsi
  // (celui des polices standard PDF). Le reste des caractères non couverts devient « ? ».
  const REPLACEMENTS = {
    ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '‑': '-', '‐': '-',
    '→': '->', '←': '<-', '⇒': '=>', '≥': '>=', '≤': '<=', '≠': '!=',
    '✓': 'x', '✔': 'x', '•': '•', '●': '•', '◦': '-', '−': '-',
    '‘': '‘', '’': '’', 'ʼ': '’', ' ': ' ',
  };

  let charset = null;

  function sanitize(text, cs) {
    const set = cs || charset;
    let out = '';
    for (const ch of String(text || '').replace(/\r\n?/g, '\n')) {
      const rep = REPLACEMENTS[ch] !== undefined ? REPLACEMENTS[ch] : ch;
      for (const c of rep) {
        const cp = c.codePointAt(0);
        out += (c === '\n' || !set || set.has(cp)) ? c : '?';
      }
    }
    return out;
  }

  /** Charge le gabarit et décrit ses champs (type, taille des cadres) pour l'interface. */
  async function inspect(templateBytes) {
    const doc = await PDFDocument.load(templateBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    charset = new Set(font.getCharacterSet());
    const form = doc.getForm();
    const fields = {};
    for (const f of form.getFields()) {
      const name = f.getName();
      if (UI_BUTTONS.includes(name)) continue;
      const widgets = f.acroField.getWidgets();
      if (f instanceof PDFTextField) {
        fields[name] = {
          kind: 'text',
          multiline: f.isMultiline(),
          fixedSize: fixedFontSize(f),
          boxes: widgets.map(w => { const r = w.getRectangle(); return { w: r.width, h: r.height, bw: borderWidth(w) }; }),
        };
      } else {
        fields[name] = { kind: 'button', options: widgets.map(w => { const on = w.getOnValue(); return on ? on.decodeText() : null; }) };
      }
    }
    return { font, fields };
  }

  function borderWidth(widget) {
    const bs = widget.getBorderStyle();
    return bs ? bs.getWidth() : 0;
  }

  function fixedFontSize(textField) {
    const da = textField.acroField.getDefaultAppearance() || '';
    const m = da.match(/(\d*\.\d+|\d+)\s+Tf/);
    const n = m ? Number(m[1]) : 0;
    return n > 0 ? n : 0;
  }

  function boundsOf(box) {
    const pad = box.bw + 1; // même marge que pdf-lib
    return { x: pad, y: pad, width: box.w - pad * 2, height: box.h - pad * 2 };
  }

  /*
   * Hauteur occupée par le texte, avec le même découpage que pdf-lib (retour à la ligne
   * au dernier espace qui tient strictement dans la largeur), mais en temps linéaire :
   * la largeur d'un mot est proportionnelle à la taille, on la mesure une fois à 1 pt.
   */
  const widthCache = new WeakMap();
  function wordWidth(font, word) {
    let m = widthCache.get(font);
    if (!m) { m = new Map(); widthCache.set(font, m); }
    let w = m.get(word);
    if (w === undefined) { w = font.widthOfTextAtSize(word, 1); if (m.size < 20000) m.set(word, w); }
    return w;
  }
  function countLines(text, font, size, maxWidth) {
    const space = wordWidth(font, ' ') * size;
    let lines = 0;
    for (const para of text.replace(/\t/g, ' ').split(/\r\n|\r|\n/)) {
      const words = para.split(' ');
      let lineW = -1;
      lines += 1;
      for (const word of words) {
        const w = wordWidth(font, word) * size;
        if (lineW < 0) { lineW = w; continue; }
        const cand = lineW + space + w;
        if (cand < maxWidth) lineW = cand;
        else { lines += 1; lineW = w; }
      }
    }
    return lines;
  }
  function usedHeight(text, font, size, bounds) {
    return countLines(text, font, size, bounds.width) * font.heightAtSize(size) * 1.2;
  }

  /**
   * Calcule la taille de police retenue pour un texte dans un cadre.
   * Retourne { size, fits, fill (0..1+ à la taille préférée), capacity (nb de caractères tenant à 8 pt) }.
   * Même algorithme de mise en page que celui utilisé à l'export.
   */
  function fit(text, box, font, multiline) {
    const t = sanitize(text);
    if (!t.trim()) return { size: PREFERRED, fits: true, fill: 0, capacity: null };
    const bounds = boundsOf(box);
    if (!multiline) {
      for (let s = PREFERRED_SINGLE; s >= MIN; s -= STEP) {
        const w = font.widthOfTextAtSize(t.replace(/\n/g, ' '), s);
        if (w <= bounds.width) return { size: s, fits: true, fill: w / bounds.width, capacity: null };
      }
      return { size: MIN, fits: false, fill: font.widthOfTextAtSize(t, MIN) / bounds.width, capacity: null };
    }
    const fillAtPreferred = usedHeight(t, font, PREFERRED, bounds) / bounds.height;
    const h8 = usedHeight(t, font, 8, bounds);
    const capacity = Math.floor(t.length * Math.min(1, bounds.height / h8));
    // Un mot plus large que le cadre ferait déborder la ligne : on réduit aussi pour l'éviter.
    const longest = Math.max(0, ...t.split(/\s+/).map(w => wordWidth(font, w)));
    for (let s = PREFERRED; s >= MIN; s -= STEP) {
      if (longest * s < bounds.width && usedHeight(t, font, s, bounds) <= bounds.height) return { size: s, fits: true, fill: fillAtPreferred, capacity };
    }
    return { size: MIN, fits: false, fill: fillAtPreferred, capacity };
  }

  /**
   * Le PDF officiel est balisé (accessibilité) : son arbre de structure pointe vers les
   * annotations des champs. pdf-lib supprime ces objets quand il retire ou aplatit un champ,
   * ce qui laisse des références cassées. On neutralise la suppression le temps de l'opération :
   * les objets restent présents (non affichés) et le fichier reste valide.
   */
  function withoutDeletes(doc, fn) {
    const del = doc.context.delete;
    doc.context.delete = () => true;
    try { fn(); } finally { doc.context.delete = del; }
  }

  /**
   * Les cases du formulaire dessinent leur marque avec la police ZapfDingbats, que
   * certains lecteurs ou imprimantes n'affichent pas. On remplace l'apparence « cochée »
   * par un carré plein vectoriel (même rendu que l'original, sans dépendre d'une police).
   */
  function drawCheckAppearances(doc, field) {
    const { pushGraphicsState, popGraphicsState, setFillingGrayscaleColor, setStrokingGrayscaleColor, setLineWidth, rectangle, fill, stroke } = PDFLib;
    for (const w of field.acroField.getWidgets()) {
      const on = w.getOnValue();
      if (!on) continue;
      const ap = w.dict.lookup(PDFName.of('AP'));
      const normal = ap && ap.lookup(PDFName.of('N'));
      // Bordure seulement là où le formulaire d'origine en trace une (cases de la page 2).
      const mk = w.getAppearanceCharacteristics();
      const bc = mk && mk.getBorderColor();
      const bordered = !!(normal && normal.get && normal.get(PDFName.of('Off')) && bc && bc.length);
      const r = w.getRectangle();
      const side = Math.min(r.width, r.height) * 0.6;
      const x = (r.width - side) / 2, y = (r.height - side) / 2;
      const base = [
        setFillingGrayscaleColor(1), rectangle(0, 0, r.width, r.height), fill(),
        ...(bordered ? [setStrokingGrayscaleColor(0), setLineWidth(0.5),
          rectangle(0.25, 0.25, r.width - 0.5, r.height - 0.5), stroke()] : []),
      ];
      const mark = [setFillingGrayscaleColor(0), rectangle(x, y, side, side), fill()];
      const xo = ops => doc.context.register(
        doc.context.formXObject([pushGraphicsState(), ...ops, popGraphicsState()], { BBox: [0, 0, r.width, r.height] }));
      const n = doc.context.obj({});
      n.set(on, xo([...base, ...mark]));
      n.set(PDFName.of('Off'), xo(base));
      w.dict.set(PDFName.of('AP'), doc.context.obj({ N: n }));
    }
  }

  /** Coche le bon widget d'un groupe de cases (A/B/C/D/SO, Oui, Mme/M…). value = nom de l'état ou '#index'. */
  function setButton(field, value) {
    const af = field.acroField;
    const widgets = af.getWidgets();
    let chosen = null;
    widgets.forEach((w, i) => {
      const on = w.getOnValue();
      const match = value !== undefined && value !== null && value !== '' && value !== false && on &&
        (value === true ? i === 0 : (on.decodeText() === value || value === '#' + i));
      if (match && !chosen) { chosen = on; w.setAppearanceState(on); }
      else w.setAppearanceState(PDFName.of('Off'));
    });
    af.dict.set(PDFName.of('V'), chosen || PDFName.of('Off'));
  }

  /**
   * Produit le PDF rempli.
   * values : { nomDuChampPDF: texte | état de case }
   * options.flatten : true = PDF figé (impression), false = champs restant modifiables.
   */
  async function build(templateBytes, values, options = {}) {
    const doc = await PDFDocument.load(templateBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const cs = new Set(font.getCharacterSet());
    charset = cs;
    const form = doc.getForm();

    withoutDeletes(doc, () => {
      for (const name of UI_BUTTONS) {
        try { form.removeField(form.getField(name)); } catch (e) { /* absent */ }
      }
    });

    for (const f of form.getFields()) {
      const name = f.getName();
      const v = values[name];
      if (f instanceof PDFTextField) {
        const text = sanitize(v, cs).replace(/[ \t]+\n/g, '\n').trimEnd();
        if (!text) continue;
        f.setText(f.isMultiline() ? text : text.replace(/\n+/g, ' '));
        if (!fixedFontSize(f)) {
          // Le DA est porté par le widget (souvent le même dictionnaire que le champ) :
          // pdf-lib le lit en priorité pour générer l'apparence.
          for (const w of f.acroField.getWidgets()) {
            const r = w.getRectangle();
            const res = fit(text, { w: r.width, h: r.height, bw: borderWidth(w) }, font, f.isMultiline());
            w.setDefaultAppearance(`/Arial ${res.size} Tf 0 g`);
          }
        }
        // Texte posé sur le formulaire sans cadre ajouté : les zones sont déjà tracées sur la page.
        for (const w of f.acroField.getWidgets()) {
          const mk = w.getAppearanceCharacteristics();
          if (mk) mk.dict.delete(PDFName.of('BC'));
          const bs = w.getBorderStyle();
          if (bs) bs.dict.set(PDFName.of('W'), doc.context.obj(0));
        }
      } else {
        drawCheckAppearances(doc, f);
        if (v !== undefined) setButton(f, v);
      }
    }

    form.updateFieldAppearances(font);
    if (options.flatten) withoutDeletes(doc, () => form.flatten());
    doc.setTitle(options.title || 'GEVA-Sco – Réexamen');
    doc.setProducer('Application GEVA-Sco ULIS');
    return doc.save();
  }

  return { inspect, fit, build, sanitize, PREFERRED, MIN, __countLines: countLines };
});
