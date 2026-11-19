'use strict';
let importController = null;
let importPreviewUrl = null;

function historicalContext(e, field) {
  const old = e.baseline?.values;
  if (!old) return '';
  const g = GevaGuidance.groupFor(GROUPS, field);
  const evolution = field === 'Evolutions-observées-et-persepectives-projet-professionnel';
  const lines = [`PRÉCÉDENT GEVA-SCO — éléments historiques à vérifier (${e.baseline.year || 'année non précisée'}). Aucune évolution ne peut être déduite sans observation actuelle.`];
  const fields = evolution ? Object.keys(AREAS) : g ? [g.c1, g.c2] : [field];
  for (const key of fields) if (typeof old[key] === 'string' && old[key].trim()) lines.push(`${AREAS[key]?.group || ''} / ${AREAS[key]?.label || key} — ancien texte : ${old[key].slice(0, 2200)}`);
  for (const group of evolution ? Object.values(GROUPS) : g ? [g] : []) {
    for (const [key, label] of group.rows) {
      if (GevaGuidance.RATINGS[old[key]]) lines.push(`${group.title} / ${label} : ancienne cotation ${old[key]} ; actuelle ${GevaGuidance.RATINGS[e.v[key]] ? e.v[key] : 'non renseignée'}.`);
    }
  }
  lines.push('FIN DES ÉLÉMENTS HISTORIQUES. Rédiger uniquement à partir des observations actuelles, ou poser des questions pour les recueillir.');
  return pseudo(lines.join('\n').slice(0, 14000), e);
}

async function guidedActivityQuestions(field, button) {
  const student = cur();
  if (!student) return;
  const selected = GevaGuidance.candidates(GROUPS, field, student.v, student.guidanceAnswers?.[field] || {}, student.baseline?.values || {});
  if (!selected.length) {
    const group = GevaGuidance.groupFor(GROUPS, field);
    const any = group.rows.some(([key]) => GevaGuidance.RATINGS[student.v[key]] || GevaGuidance.RATINGS[student.baseline?.values?.[key]]);
    return toast(any ? 'Aucune nouvelle question prioritaire pour ce cadre. Relisez vos réponses dans les notes ; les activités A et sans objet ne sont pas traitées comme des difficultés.' : 'Cotez au moins une activité du tableau pour obtenir des questions ciblées.');
  }
  modal(`<div class="modal"><div class="modal-head"><h2>Questions ciblées — ${esc(AREAS[field].group)}</h2><button class="x" data-close aria-label="Fermer">×</button></div><div class="modal-body" id="guided-loading"><p class="hint">${esc(AREAS[field].label)}</p><div class="loading"><span class="spin"></span>Adaptation des questions aux cotations et aux notes…</div></div></div>`);
  const loading = document.querySelector('#guided-loading');
  if (button) button.disabled = true;
  let questions = selected;
  let fallback = false;
  try {
    const prompt = `${areaContext(field)}\nNotes actuelles :\n${pseudo(student.notes[field] || '(aucune)', student)}\nTexte actuel :\n${pseudo(String(student.v[field] || '(vide)'), student)}\n\nVoici une sélection de questions de référence propres aux activités concernées :\n${JSON.stringify(selected.map(q => ({ id: q.id, activity: q.label, cote: q.cote, historiqueSeulement: q.historicalOnly, question: q.question })))}\n\nAdapte légèrement chaque question aux informations qui manquent dans les notes. Conserve exactement les identifiants, une question par identifiant, le thème de chaque activité et l’angle du cadre. Ne pose aucune question sur une autre activité. Pour une ancienne cotation sans cotation actuelle, demande ce qui est observable aujourd’hui, sans supposer que la difficulté persiste. Ne transforme pas une cotation D en diagnostic ou en incapacité présumée. Réponds uniquement en JSON : {"questions":[{"id":"identifiant exact","question":"question adaptée"}]}.`;
    const raw = await callAlbert([{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }], 1800);
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    const valid = GevaGuidance.validateQuestions(parsed, selected);
    if (!valid) throw new Error('Sélection de questions non conforme');
    questions = valid.map(q => ({ ...q, question: unpseudo(q.question, student) }));
  } catch (error) {
    fallback = true;
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
  if (!loading.isConnected || cur()?.id !== student.id) return;
  showQuestions(field, questions, fallback ? 'Les questions de référence sont disponibles. L’adaptation par Albert n’a pas abouti.' : 'Questions adaptées aux activités cotées de ce tableau.');
}

function renderHistory() {
  const e = cur();
  const title = head(SECTIONS.find(s => s.id === 'history'));
  if (!e?.baseline) return `${title}<p class="intro">Importez un précédent GEVA-Sco pour reprendre les informations administratives et disposer d’un point de comparaison.</p><button class="btn primary" data-menu-direct="import-geva">Importer un GEVA-Sco (PDF ou scan)</button>`;
  const old = e.baseline.values || {};
  return `${title}<div class="card"><p><strong>Document de référence :</strong> ${esc(e.baseline.sourceName)}${e.baseline.year ? ' · ' + esc(e.baseline.year) : ''}${e.baseline.meetingDate ? ' · ESS du ' + esc(e.baseline.meetingDate.split('-').reverse().join('/')) : ''}</p><p class="hint">Les anciennes observations sont conservées comme référence. Les cotations et commentaires du nouveau GEVA-Sco sont à renseigner avec les observations actuelles. Un changement de cotation ne suffit pas, seul, à conclure à un progrès ou à une régression.</p><button class="btn" data-act="evolutionQuestions" data-f="Evolutions-observées-et-persepectives-projet-professionnel">Questions pour faire le point sur les évolutions</button></div>
    ${Object.values(GROUPS).map(g => `<section class="card"><h3>${esc(g.title)}</h3><div class="table-scroll"><table class="acts"><thead><tr><th>Activité</th><th>Précédent GEVA-Sco</th><th>Actuellement</th></tr></thead><tbody>${g.rows.map(([key, label]) => `<tr><td>${esc(label)}</td><td>${esc(GevaGuidance.RATINGS[old[key]] ? old[key] : 'Non renseignée')}</td><td>${esc(GevaGuidance.RATINGS[e.v[key]] ? e.v[key] : 'À observer / coter')}</td></tr>`).join('')}</tbody></table></div><details><summary>Lire les anciens commentaires de ce tableau</summary><p><strong>Obstacles — ancien texte</strong></p><blockquote class="historical">${esc(old[g.c1] || 'Non renseigné')}</blockquote><p><strong>Appuis — ancien texte</strong></p><blockquote class="historical">${esc(old[g.c2] || 'Non renseigné')}</blockquote></details><p><button class="btn small" data-act="questions" data-f="${esc(g.c1)}">Questions sur les obstacles</button> <button class="btn small" data-act="questions" data-f="${esc(g.c2)}">Questions sur les appuis</button></p><a data-go="${g.page === 4 ? 'obs1' : 'obs2'}" href="#">Renseigner les observations actuelles de ce tableau</a></section>`).join('')}
    <section class="card"><h3>Autres observations du précédent document</h3>${Object.entries(AREAS).filter(([key, area]) => !area.group && old[key]).map(([key, area]) => `<details><summary>${esc(area.label)}</summary><blockquote class="historical">${esc(old[key])}</blockquote></details>`).join('') || '<p class="hint">Aucun autre commentaire reconnu.</p>'}</section>
    <h3 class="sub">Mes observations actuelles sur les évolutions</h3>${area('Evolutions-observées-et-persepectives-projet-professionnel', { rows: 6 })}`;
}

async function beginPdfImport(file, forceOcr = false) {
  closeModal();
  const controller = new AbortController();
  importController = controller;
  modal(`<div class="modal"><div class="modal-head"><h2>Importer un précédent GEVA-Sco</h2><button class="x" data-close aria-label="Fermer">×</button></div><div class="modal-body"><p>Le PDF et la reconnaissance des scans sont traités sur cet appareil.</p><p class="loading"><span class="spin"></span><span id="import-progress" role="status" aria-live="polite">Préparation…</span></p><p class="hint">La lecture d’un scan peut prendre plusieurs minutes. Aucune fiche n’est créée avant votre vérification.</p></div><div class="modal-foot"><button class="btn" data-close>Annuler</button></div></div>`);
  try {
    const template = tpl?.bytes || new Uint8Array(await (await fetch('geva-sco-reexamen.pdf')).arrayBuffer());
    const result = await GevaImport.read(file, template, { signal: controller.signal, forceOcr, onProgress: message => { const out = document.querySelector('#import-progress'); if (out && !controller.signal.aborted) out.textContent = message; } });
    if (controller.signal.aborted || importController !== controller) return;
    importController = null;
    importPreviewUrl = URL.createObjectURL(file);
    showImportReview(result, file);
  } catch (error) {
    if (controller.signal.aborted || importController !== controller) return;
    importController = null;
    const message = /encrypted|password/i.test(error.message) ? 'Ce PDF est protégé par un mot de passe. Importez une copie déverrouillée.' : error.message;
    modal(`<div class="modal"><div class="modal-head"><h2>Import non terminé</h2><button class="x" data-close aria-label="Fermer">×</button></div><div class="modal-body"><p>${esc(message)}</p><p class="hint">Les fiches existantes n’ont pas été modifiées.</p></div><div class="modal-foot"><button class="btn" data-close>Fermer</button></div></div>`);
  }
}

function showImportReview(result, sourceFile) {
  const v = result.values;
  const renderAdmin = ([key, label]) => `<div class="fld"><label for="imp-${esc(key)}">${esc(label)}</label><input id="imp-${esc(key)}" data-import-key="${esc(key)}" type="${key === '_naissance' ? 'date' : 'text'}" value="${esc(v[key] || '')}"></div>`;
  const mainAdmin = GevaImport.ADMIN.filter(([key]) => !key.startsWith('Personne'));
  const parents = GevaImport.ADMIN.filter(([key]) => key.startsWith('Personne'));
  const recognized = GevaImport.ADMIN.filter(([key]) => v[key]).length;
  modal(`<div class="modal wide"><div class="modal-head"><h2>Vérifier l’import avant de créer la fiche</h2><button class="x" data-close aria-label="Fermer">×</button></div><div class="modal-body" id="import-review">
    <p><strong>${esc(result.name)}</strong> · ${result.pages} page(s) · ${result.method === 'scan' ? 'reconnaissance de scan' : result.method === 'formulaire' ? 'formulaire PDF' : 'lecture du texte'} · ${recognized} information(s) administrative(s) proposée(s).</p>
    <p><a href="${esc(importPreviewUrl)}" target="_blank" rel="noopener">Consulter le PDF original pour vérifier</a></p>
    ${result.warnings.map(w => `<p class="import-warning">${esc(w)}</p>`).join('')}
    <p class="hint">Corrigez les propositions ci-dessous. Le nom et le prénom doivent être vérifiés, notamment les noms composés. Une nouvelle fiche sera ajoutée ; aucune fiche existante ne sera remplacée.</p>
    <h3>Informations administratives à reprendre</h3><div class="grid g2">${mainAdmin.map(renderAdmin).join('')}</div>
    <details><summary>Responsables légaux — vérifier les coordonnées proposées</summary><div class="grid g2">${parents.map(renderAdmin).join('')}</div></details>
    <h3>Repères du précédent GEVA-Sco</h3><div class="grid g2"><div class="fld"><label for="import-year">Ancienne année scolaire</label><input id="import-year" value="${esc(v._annee || '')}" placeholder="2025-2026"></div><div class="fld"><label for="import-date">Ancienne date de réunion</label><input id="import-date" type="date" value="${esc(v._dateEss || '')}"></div></div>
    <details><summary>Anciennes cotations et commentaires — à vérifier pour la comparaison</summary><p class="hint">Ces éléments resteront historiques. Une case non reconnue reste « non renseignée ».</p>${Object.values(GROUPS).map(g => `<h4>${esc(g.title)}</h4><div class="grid g2">${g.rows.map(([key, label]) => `<div class="fld"><label for="prior-${esc(key)}">${esc(label)} — ancienne cotation</label><select id="prior-${esc(key)}" data-prior-rating="${esc(key)}"><option value="">Non renseignée</option>${COTES.map(c => `<option value="${c}" ${v[key] === c ? 'selected' : ''}>${c === 'SO' ? 'Sans objet' : c}</option>`).join('')}</select></div>`).join('')}</div>`).join('')}
    ${Object.entries(AREAS).map(([key, area]) => `<div class="fld"><label for="prior-text-${esc(key)}">${esc(area.group ? area.group + ' — ' + area.label : area.label)} — ancien texte</label><textarea id="prior-text-${esc(key)}" data-prior-text="${esc(key)}" rows="3">${esc(v[key] || '')}</textarea></div>`).join('')}</details>
    <details><summary>Texte reconnu dans le document</summary><p class="hint">Utilisez ce texte pour retrouver les informations que la lecture automatique n’a pas classées.</p><pre class="extracted-text">${esc(result.rawText)}</pre></details>
    <p class="hint">La nouvelle fiche utilisera l’année scolaire actuelle. La classe, la date de la prochaine ESS, les nouvelles cotations et les observations actuelles seront à renseigner.</p><p id="import-review-error" role="alert" class="import-warning" hidden></p>
    </div><div class="modal-foot"><button class="btn" data-close>Annuler</button><button class="btn" id="import-as-scan">Relire comme un scan</button><button class="btn primary" id="import-confirm">Créer la fiche avec ces informations</button></div></div>`);
  document.querySelector('#import-as-scan').onclick = () => beginPdfImport(sourceFile, true);
  document.querySelector('#import-confirm').onclick = () => {
    const sourceIdentity = Object.fromEntries(Object.entries(v).filter(([key]) => ['_nom','_prenom'].includes(key) || /^Personne[123]_Nom-ligne[12]$/.test(key)));
    const administrative = Object.create(null);
    for (const input of document.querySelectorAll('[data-import-key]')) administrative[input.dataset.importKey] = input.value.trim();
    if (!administrative._nom && !administrative._prenom) {
      const error = document.querySelector('#import-review-error'); error.hidden = false; error.textContent = 'Renseignez au moins le nom ou le prénom de l’élève avant de créer la fiche.'; document.querySelector('#imp-_nom').focus(); return;
    }
    for (const input of document.querySelectorAll('[data-prior-rating]')) { if (input.value) v[input.dataset.priorRating] = input.value; else delete v[input.dataset.priorRating]; }
    for (const input of document.querySelectorAll('[data-prior-text]')) { if (input.value.trim()) v[input.dataset.priorText] = input.value.trim(); else delete v[input.dataset.priorText]; }
    const year = document.querySelector('#import-year').value.trim();
    const meetingDate = document.querySelector('#import-date').value;
    // La relecture de l’identité sert aussi à pseudonymiser les anciens textes.
    Object.assign(v, administrative, { _annee: year, _dateEss: meetingDate });
    const e = newEleve();
    for (const [key, value] of Object.entries(administrative)) if (value) e.v[key] = value;
    e.baseline = { sourceName: result.name, method: result.method, importedAt: new Date().toISOString(), year, meetingDate, values: v, sourceIdentity, rawText: result.rawText };
    db.eleves.push(e); db.currentId = e.id; section = 'ident';
    closeModal(); save(); render();
    toast('Fiche créée. Vérifiez les coordonnées, puis consultez « Depuis le précédent GEVA-Sco ».');
  };
}

document.querySelector('#file-geva').addEventListener('change', event => {
  const file = event.target.files[0]; event.target.value = '';
  if (file) beginPdfImport(file);
});
