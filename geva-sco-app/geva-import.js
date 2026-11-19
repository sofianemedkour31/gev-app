(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/pdf-lib.min.js'));
  else root.GevaImport = factory(root.PDFLib);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PDFLib) {
  'use strict';
  const { PDFDocument, PDFTextField, PDFName } = PDFLib;
  const COTES = ['A', 'B', 'C', 'D', 'SO'];
  const ADMIN = [
    ['_nom', 'Nom de l’élève'], ['_prenom', 'Prénom de l’élève'], ['_naissance', 'Date de naissance'],
    ['Numero-dossier-MDPH', 'N° de dossier MDPH'], ['Numero-et-rue', 'Adresse de l’élève'], ['Code-postal', 'Code postal'], ['Ville', 'Ville'], ['Tel', 'Téléphone'], ['Courriel', 'Courriel'],
    ['Etablissement-scolaire', 'Établissement scolaire'], ['Etablissement-scolaire_Numero-et-rue', 'Adresse de l’établissement'],
    ['Points-saillants-scolarisation_Code-postal', 'Code postal de l’établissement'], ['Etablissement-scolaire_Ville', 'Ville de l’établissement'],
    ['Coordonnees-enseignant_Nom', 'Enseignant référent — nom et coordonnées'], ['Coordonnees-enseignant_Telephone', 'Téléphone du référent'], ['Coordonnees-enseignant_Courriel', 'Courriel du référent'],
  ];
  for (let n = 1; n <= 3; n++) {
    const who = n === 3 ? 'Responsable légal' : `Parent ${n}`;
    for (const [suffix, label] of [['', 'Civilité (Mme ou M)'], ['_Nom-ligne1', 'Nom et prénom'], ['_Nom-ligne2', 'Complément'], ['_Numero-et-rue', 'Adresse'], ['_Code-postal', 'Code postal'], ['_Ville', 'Ville'], ['_Telephone', 'Téléphone'], ['_Courriel', 'Courriel']]) ADMIN.push([`Personne${n}${suffix}`, `${who} — ${label}`]);
  }
  function clean(value) {
    if (typeof value !== 'string') return '';
    const text = value.replace(/\u0000/g, '').trim();
    return /^[\s.·…_\-/]*$/.test(text) ? '' : text;
  }
  function dateFromParts(day, month, year) {
    const d = Number(day), m = Number(month);
    let y = Number(year);
    if (!/^\d{2}(\d{2})?$/.test(clean(year)) || !y) return '';
    if (y < 100) y += y > 70 ? 1900 : 2000;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
  }
  function normalize(raw) {
    const values = Object.create(null);
    for (const [key, value] of Object.entries(raw || {})) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      if (typeof value === 'string') values[key] = (/^(Date-|Annee-)/.test(key) ? cleanOcrField(key, value) : clean(value)).slice(0, 12000);
      else if (typeof value === 'boolean') values[key] = value;
    }
    const name = clean(values['Nom-et-prenom-de-l-eleve'] || values['Nom-eleve']);
    if (name && !values._nom && !values._prenom) {
      const parts = name.split(/\s+/);
      const boundary = parts.findIndex(p => /[a-zà-ÿ]/.test(p));
      // Les noms exportés par l’application sont NOM Prénom. Toute ambiguïté reste à relire.
      if (boundary > 0) { values._nom = parts.slice(0, boundary).join(' '); values._prenom = parts.slice(boundary).join(' '); }
      else values._nom = name;
    }
    values._naissance = dateFromParts(values['Date-naissance_Jour'], values['Date-naissance_Mois'], values['Date-naissance_Annee']) || clean(values._naissance);
    values._dateEss = dateFromParts(values['Date-reunion_Jour'], values['Date-reunion_Mois'], values['Date-reunion_Annee']) || clean(values._dateEss);
    const start = clean(values['Annee-scolaire-debut']), end = clean(values['Annee-scolaire-fin']);
    if (/^\d{2}(\d{2})?$/.test(start) && /^\d{2}(\d{2})?$/.test(end)) values._annee = `${start.length === 2 ? '20' : ''}${start}-${end.length === 2 ? '20' : ''}${end}`;
    return values;
  }
  async function readFields(bytes, allowedNames) {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const values = Object.create(null);
    for (const field of doc.getForm().getFields()) {
      const name = field.getName();
      if (!allowedNames.has(name)) continue;
      if (field instanceof PDFTextField) {
        const text = field.getText();
        if (text?.trim()) values[name] = text;
      } else {
        const state = field.acroField.dict.lookup(PDFName.of('V'));
        const rawSelected = state?.decodeText?.();
        const exported = typeof field.getSelected === 'function' ? field.getSelected() : null;
        const selected = typeof exported === 'string' ? exported : rawSelected;
        if (!selected || selected === 'Off') continue;
        if (name === 'Scolarite') {
          const index = field.acroField.getWidgets().findIndex(w => w.getOnValue()?.decodeText() === rawSelected);
          if (index >= 0) values[name] = `#${index}`;
        } else if (COTES.includes(selected) || /^Personne[123]$/.test(name) || name === 'Accessibilite-du-bati') values[name] = selected;
        else values[name] = true;
      }
    }
    return values;
  }
  async function templateLayout(bytes) {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const pages = doc.getPages();
    const result = [];
    for (const field of doc.getForm().getFields()) {
      if (!(field instanceof PDFTextField)) continue;
      for (const widget of field.acroField.getWidgets()) {
        const pageRef = widget.dict.get(PDFName.of('P'));
        let page = pages.findIndex(p => p.ref.toString() === pageRef?.toString());
        if (page < 0) page = pages.findIndex(p => (p.node.Annots()?.asArray() || []).some(ref => doc.context.lookup(ref) === widget.dict));
        if (page >= 0) result.push({ name: field.getName(), page, ...widget.getRectangle(), pageWidth: pages[page].getWidth(), pageHeight: pages[page].getHeight() });
      }
    }
    return { fields: result, pageCount: pages.length };
  }
  function inBox(item, box) {
    const centerX = item.x + (item.width || 0) / 2;
    return centerX >= box.x - 1 && centerX <= box.x + box.width + 1 && item.y >= box.y - 1 && item.y <= box.y + box.height + 1;
  }
  function textInBox(items, box) {
    const selected = items.filter(item => clean(item.text) && inBox(item, box)).sort((a, b) => Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x);
    let text = '', previous = null;
    for (const item of selected) {
      text += text ? (previous && Math.abs(previous.y - item.y) > 3 ? '\n' : ' ') : '';
      text += item.text;
      previous = item;
    }
    return clean(text);
  }
  function extractLabelled(text) {
    const values = Object.create(null);
    const labels = [
      ['Nom-et-prenom-de-l-eleve', /nom\s+et\s+pr[ée]nom\s+de\s+l[’']?[ée]l[èe]ve\s*[:：]\s*([^\n]+)/i],
      ['Numero-dossier-MDPH', /(?:n[°ºo]\s*(?:de\s*)?dossier\s*(?:MDPH)?|dossier\s+MDPH)\s*[:：]\s*([^\n]+)/i],
      ['Etablissement-scolaire', /[ée]tablissement\s+scolaire(?:\s+fr[ée]quent[ée])?\s*[:：]\s*([^\n]+)/i],
    ];
    for (const [key, expression] of labels) {
      const match = text.match(expression);
      if (match) values[key] = cleanOcrField(key, match[1].split(/\s+(?:Date de naissance|Pour l[’']ann[ée]e|Classe fr[ée]quent[ée]e)\s*[:：]?/i)[0]);
    }
    for (const [prefix, label] of [['Date-naissance', 'naissance'], ['Date-reunion', 'r[ée]union']]) {
      const match = text.match(new RegExp(`date\\s+(?:de\\s+)?${label}[^\\d\\n]{0,100}(\\d{1,2})[\\s/._-]+(\\d{1,2})[\\s/._-]+(\\d{4})`, 'i'));
      if (match) { values[`${prefix}_Jour`] = match[1]; values[`${prefix}_Mois`] = match[2]; values[`${prefix}_Annee`] = match[3]; }
    }
    const year = text.match(/ann[ée]e\s+scolaire\s*[:：]?\s*20\s*(\d{2})\s*[/_-]\s*20\s*(\d{2})/i);
    if (year) { values['Annee-scolaire-debut'] = year[1]; values['Annee-scolaire-fin'] = year[2]; }
    return values;
  }
  function abortIfNeeded(signal) { if (signal?.aborted) throw new DOMException('Import annulé', 'AbortError'); }
  async function withAbort(promise, signal) {
    abortIfNeeded(signal);
    if (!signal) return promise;
    let abort;
    const canceled = new Promise((resolve, reject) => { abort = () => reject(new DOMException('Import annulé', 'AbortError')); signal.addEventListener('abort', abort, { once: true }); });
    try { return await Promise.race([promise, canceled]); }
    finally { signal.removeEventListener('abort', abort); }
  }
  let pdfjsPromise;
  async function pdfjs() {
    if (!pdfjsPromise) pdfjsPromise = import('./vendor/pdfjs/build/pdf.mjs').then(lib => { lib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/build/pdf.worker.mjs', document.baseURI).href; return lib; });
    return pdfjsPromise;
  }
  let ocrScriptPromise;
  async function ocrLibrary() {
    if (!ocrScriptPromise) ocrScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/ocr/tesseract.min.js';
      script.onload = () => resolve(globalThis.Tesseract);
      script.onerror = () => { ocrScriptPromise = null; reject(new Error('Le moteur de lecture des scans n’a pas pu être chargé.')); };
      document.head.appendChild(script);
    });
    return ocrScriptPromise;
  }
  function ocrItems(data, viewport) {
    const words = (data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => (p.lines || []).flatMap(l => l.words || [])));
    return words.filter(word => typeof word.confidence !== 'number' || word.confidence >= 55).map(word => {
      const [x, y] = viewport.convertToPdfPoint(word.bbox.x0, word.bbox.y1);
      return { text: word.text || '', x, y };
    });
  }
  function cropForOcr(source, viewport, box) {
    const rect = [...viewport.convertToViewportPoint(box.x, box.y), ...viewport.convertToViewportPoint(box.x + box.width, box.y + box.height)];
    const sx = Math.min(rect[0], rect[2]), sy = Math.min(rect[1], rect[3]);
    const sw = Math.abs(rect[2] - rect[0]);
    // Retirer la ligne de pointillés située sous le texte, sans couper les lettres.
    const sh = Math.max(1, Math.abs(rect[3] - rect[1]) - viewport.scale * (box.height < 10 ? 1 : 3));
    const result = document.createElement('canvas');
    const zoom = 2;
    result.width = Math.ceil(sw * zoom) + 24; result.height = Math.ceil(sh * zoom) + 24;
    const ctx = result.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, result.width, result.height);
    ctx.drawImage(source, sx, sy, sw, sh, 12, 12, sw * zoom, sh * zoom);
    const pixels = ctx.getImageData(12, 12, Math.ceil(sw * zoom), Math.ceil(sh * zoom));
    let dark = 0;
    for (let i = 0; i < pixels.data.length; i += 4) if (pixels.data[i] < 150 && pixels.data[i + 1] < 150 && pixels.data[i + 2] < 150) dark++;
    return { canvas: result, ink: dark / (pixels.width * pixels.height) };
  }
  function cleanOcrField(name, value) {
    const text = clean(value.replace(/(?:[._·…]\s*){2,}/g, ' ').replace(/_+$/g, ''));
    if (!text) return '';
    if (/^(Date-|Annee-)/.test(name)) return /^\d{1,4}$/.test(text.replace(/\s/g, '')) ? text.replace(/\s/g, '') : '';
    if (/Code-postal$/.test(name)) return /^\d{5}$/.test(text.replace(/\s/g, '')) ? text.replace(/\s/g, '') : '';
    if (/Courriel$/.test(name)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : '';
    if (/Telephone$|^Tel$/.test(name)) return /^[+()\d\s.-]{6,25}$/.test(text) ? text : '';
    return /[\p{L}\d]/u.test(text) ? text : '';
  }
  async function read(file, templateBytes, options = {}) {
    const { signal, onProgress = () => {}, forceOcr = false } = options;
    if (!file || file.size > 25 * 1024 * 1024) throw new Error('Choisissez un PDF de moins de 25 Mo.');
    abortIfNeeded(signal);
    onProgress('Lecture du PDF…');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const layout = await templateLayout(templateBytes);
    const allowed = new Set(layout.fields.map(f => f.name));
    const adminNames = new Set([...ADMIN.map(([key]) => key), 'Nom-et-prenom-de-l-eleve']);
    const templateDoc = await PDFDocument.load(templateBytes);
    templateDoc.getForm().getFields().forEach(f => allowed.add(f.getName()));
    let values = await readFields(bytes, allowed);
    const hasFields = Object.keys(values).length > 0;
    const lib = await pdfjs();
    const task = lib.getDocument({ data: bytes.slice(), standardFontDataUrl: new URL('vendor/pdfjs/standard_fonts/', document.baseURI).href, cMapUrl: new URL('vendor/pdfjs/cmaps/', document.baseURI).href, cMapPacked: true, wasmUrl: new URL('vendor/pdfjs/wasm/', document.baseURI).href, isEvalSupported: false });
    const cancelLoading = () => { task.destroy().catch(() => {}); };
    signal?.addEventListener('abort', cancelLoading, { once: true });
    let worker, documentPdf;
    const pages = [], warnings = [];
    let ocrPages = 0;
    try {
      documentPdf = await task.promise;
      if (documentPdf.numPages > 20) throw new Error('Ce PDF dépasse 20 pages. Importez uniquement les pages du GEVA-Sco.');
      for (let number = 1; number <= documentPdf.numPages; number++) {
        abortIfNeeded(signal);
        onProgress(`Lecture de la page ${number}/${documentPdf.numPages}…`);
        const page = await documentPdf.getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        let items = content.items.filter(item => typeof item.str === 'string').map(item => ({ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width }));
        let raw = items.map(item => item.text).join(' ');
        if (forceOcr || raw.replace(/\s/g, '').length < 40) {
          if (!worker) {
            const tesseract = await ocrLibrary();
            abortIfNeeded(signal);
            onProgress('Préparation de la reconnaissance des scans en français…');
            const pendingWorker = tesseract.createWorker('fra', 1, {
              workerPath: new URL('vendor/ocr/worker.min.js', document.baseURI).href,
              corePath: new URL('vendor/ocr/core/', document.baseURI).href,
              langPath: new URL('vendor/ocr/lang/', document.baseURI).href.replace(/\/$/, ''),
              workerBlobURL: false,
              logger: message => { if (message.status === 'recognizing text') onProgress(`Reconnaissance du scan — page ${number}/${documentPdf.numPages} : ${Math.round(message.progress * 100)} %`); },
            });
            pendingWorker.then(created => { if (signal?.aborted) return created.terminate(); }).catch(() => {});
            worker = await withAbort(pendingWorker, signal);
          }
          abortIfNeeded(signal);
          const scale = Math.min(2.4, 2000 / Math.max(viewport.width, viewport.height));
          const rendered = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(rendered.width); canvas.height = Math.ceil(rendered.height);
          const renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: rendered });
          await renderTask.promise;
          abortIfNeeded(signal);
          const result = await withAbort(worker.recognize(canvas, {}, { text: true, blocks: true }), signal);
          abortIfNeeded(signal);
          items = ocrItems(result.data, rendered);
          raw = result.data.text || '';
          if (number === 1 && documentPdf.numPages === layout.pageCount) {
            onProgress('Vérification ciblée des petits champs administratifs du scan…');
            await worker.setParameters({ tessedit_pageseg_mode: '7' });
            try {
              for (const box of layout.fields.filter(b => b.page === 0 && (adminNames.has(b.name) || /^(Date-|Annee-)/.test(b.name)))) {
                abortIfNeeded(signal);
                if (values[box.name]) continue;
                const cropped = cropForOcr(canvas, rendered, { ...box, x: box.x * (page.view[2] - page.view[0]) / box.pageWidth, y: box.y * (page.view[3] - page.view[1]) / box.pageHeight, width: box.width * (page.view[2] - page.view[0]) / box.pageWidth, height: box.height * (page.view[3] - page.view[1]) / box.pageHeight });
                if (cropped.ink < 0.006) { cropped.canvas.width = cropped.canvas.height = 0; continue; }
                const read = await withAbort(worker.recognize(cropped.canvas, {}, { text: true }), signal);
                cropped.canvas.width = cropped.canvas.height = 0;
                const text = cleanOcrField(box.name, read.data.text || '');
                if (text && read.data.confidence >= 50) values[box.name] = text;
              }
            } finally { await worker.setParameters({ tessedit_pageseg_mode: '3' }); }
          }
          canvas.width = canvas.height = 0;
          ocrPages++;
        }
        pages.push({ items, text: raw, width: page.view[2] - page.view[0], height: page.view[3] - page.view[1] });
        page.cleanup();
      }
      const rawText = pages.map((p, i) => `Page ${i + 1}\n${p.text}`).join('\n\n').slice(0, 120000);
      // La lecture par zones est réservée au modèle réexamen de huit pages.
      const matchesLayout = pages.length === layout.pageCount && /GEVA[\s-]*Sco|r[ée]examen/i.test(rawText);
      if (matchesLayout && (!hasFields || ocrPages)) {
        for (const box of layout.fields) {
          if (values[box.name]) continue;
          const page = pages[box.page];
          const scaled = { x: box.x * page.width / box.pageWidth, y: box.y * page.height / box.pageHeight, width: box.width * page.width / box.pageWidth, height: box.height * page.height / box.pageHeight };
          const text = ocrPages && box.page === 0 ? cleanOcrField(box.name, textInBox(page.items, scaled)) : textInBox(page.items, scaled);
          if (text) values[box.name] = text;
        }
      } else if (!hasFields) warnings.push('La mise en page diffère du modèle réexamen de huit pages : les propositions automatiques sont limitées. Consultez le texte extrait et complétez les champs utiles.');
      const labelled = extractLabelled(rawText);
      if (ocrPages) {
        // Les dates regroupées par l’OCR restent plus fiables que trois petits chiffres isolés.
        for (const [key, value] of Object.entries(labelled)) if (value && (!values[key] || /^(Date-|Annee-)/.test(key) || key === 'Nom-et-prenom-de-l-eleve')) values[key] = value;
      }
      values = normalize({ ...labelled, ...values });
      if (ocrPages) warnings.push('La reconnaissance des scans peut contenir des erreurs. Vérifiez chaque information avec le document original. Les cotations des scans ne sont pas déduites automatiquement.');
      if (!hasFields) warnings.push('Les cases cochées d’un PDF figé ne sont pas reprises automatiquement : renseignez les anciennes cotations utiles dans la vérification.');
      if (!rawText.trim() && !hasFields) throw new Error('Aucun texte n’a pu être reconnu. Essayez un scan plus net.');
      return { values, rawText, warnings, pages: pages.length, method: ocrPages ? 'scan' : hasFields ? 'formulaire' : 'texte', name: file.name || 'GEVA-Sco importé' };
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Import annulé', 'AbortError');
      if (error.name === 'PasswordException' || /encrypted|password/i.test(error.message)) throw new Error('Ce PDF est protégé par un mot de passe. Importez une copie déverrouillée.');
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancelLoading);
      await worker?.terminate();
      await task.destroy();
    }
  }
  return { ADMIN, COTES, normalize, dateFromParts, readFields, templateLayout, textInBox, extractLabelled, cleanOcrField, read };
});
