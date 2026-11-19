const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const guidance = require('../geva-guidance.js');
const importer = require('../geva-import.js');
const exporter = require('../geva-export.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const groups = JSON.parse(JSON.stringify(vm.runInNewContext('(' + html.match(/const GROUPS = (\{[\s\S]*?\n\});/)[1] + ')')));
const template = fs.readFileSync(path.join(__dirname, '../geva-sco-reexamen.pdf'));

test('every activity has its own pair of questions', () => {
  for (const group of Object.values(groups)) for (const [key] of group.rows) {
    assert.equal(guidance.BANK[key]?.length, 2, key);
    assert.notEqual(...guidance.BANK[key]);
  }
});
test('questions use only rated activities of the requested thematic table', () => {
  const values = { 'Fixer-son-attention': 'C', Lire: 'D', Parler: 'C', Ecrire: 'SO' };
  const attention = guidance.candidates(groups, groups.g1.c1, values);
  const school = guidance.candidates(groups, groups.g5.c1, values);
  assert.deepEqual(attention.map(q => q.activity), ['Fixer-son-attention']);
  assert.deepEqual(school.map(q => q.activity), ['Lire']);
  assert.notEqual(attention[0].question, school[0].question);
  assert.match(guidance.context(groups, groups.g5.c1, values), /non cotée/);
});
test('obstacles and appuis are distinct and A is never treated as a difficulty', () => {
  const values = { Lire: 'D', Ecrire: 'A', Calculer: 'B' };
  const obstacles = guidance.candidates(groups, groups.g5.c1, values);
  const appuis = guidance.candidates(groups, groups.g5.c2, values);
  assert.ok(!obstacles.some(q => q.activity === 'Ecrire'));
  assert.ok(appuis.some(q => q.activity === 'Ecrire'));
  assert.notEqual(obstacles.find(q => q.activity === 'Lire').question, appuis.find(q => q.activity === 'Lire').question);
});
test('answered questions are omitted until their cotation changes', () => {
  const initial = guidance.candidates(groups, groups.g5.c1, { Lire: 'C' });
  const answered = { [initial[0].id]: { answer: 'Observation renseignée.' } };
  assert.equal(guidance.candidates(groups, groups.g5.c1, { Lire: 'C' }, answered).length, 0);
  assert.equal(guidance.candidates(groups, groups.g5.c1, { Lire: 'D' }, answered).length, 1);
});
test('historical cotations remain explicitly historical when no current rating exists', () => {
  const questions = guidance.candidates(groups, groups.g5.c1, {}, {}, { Lire: 'C' });
  assert.equal(questions[0].historicalOnly, true);
  assert.match(questions[0].question, /précédent GEVA-Sco/);
  const answered = { [questions[0].id]: { answer: 'Observation actuelle.' } };
  assert.equal(guidance.candidates(groups, groups.g5.c1, {}, answered, { Lire: 'C' }).length, 0);
  assert.equal(guidance.candidates(groups, groups.g5.c1, { Lire: 'C' }, answered, { Lire: 'C' }).length, 0);
});
test('unrelated, duplicate and incomplete AI question selections are rejected', () => {
  const selected = guidance.candidates(groups, groups.g5.c1, { Lire: 'C', Ecrire: 'D' });
  assert.equal(guidance.validateQuestions({ questions: [{ id: 'Parler:C:obstacles', question: 'Hors thème ?' }] }, selected), null);
  assert.equal(guidance.validateQuestions({ questions: selected.slice(0, 1) }, selected), null);
  assert.equal(guidance.validateQuestions({ questions: [selected[0], selected[0]] }, selected), null);
  assert.equal(guidance.validateQuestions({ questions: selected }, selected).length, 2);
});
test('evolution questions compare ratings without assuming success or inventing aids', () => {
  const questions = guidance.evolutionQuestions(groups, { Lire:'D', Ecrire:'B' }, { Lire:'D', Ecrire:'C', [groups.g5.c2]:'Ancien appui visuel.' });
  assert.equal(questions.length, 3);
  assert.match(questions[0].question, /dans les deux documents/);
  assert.match(questions[1].question, /ancienne cotation était C et l’actuelle est B/);
  assert.match(questions[2].question, /décrits dans les anciens commentaires/);
  assert.doesNotMatch(questions.map(q=>q.question).join('\n'), /réussit|dictée|modèle/);
});
test('identity and historical dates normalize without inventing a given name', () => {
  const v = importer.normalize({ 'Nom-et-prenom-de-l-eleve': 'DUPONT MARTIN Léo Paul', 'Date-naissance_Jour': '04', 'Date-naissance_Mois': '06', 'Date-naissance_Annee': '2017', 'Annee-scolaire-debut': '25', 'Annee-scolaire-fin': '26' });
  assert.equal(v._nom, 'DUPONT MARTIN'); assert.equal(v._prenom, 'Léo Paul'); assert.equal(v._naissance, '2017-06-04'); assert.equal(v._annee, '2025-2026');
  assert.equal(importer.normalize({ 'Nom-eleve': 'DUPONT LEO' })._prenom, undefined);
  assert.equal(importer.dateFromParts('31', '02', '2025'), '');
  const flat = importer.normalize({ 'Annee-scolaire-debut': '20.........\n25', 'Annee-scolaire-fin': '20.........\n26', 'Date-reunion_Jour': '12', 'Date-reunion_Mois': '03', 'Date-reunion_Annee': '20.......\n26' });
  assert.equal(flat._annee, '2025-2026'); assert.equal(flat._dateEss, '2026-03-12');
});
test('PDF form round-trip imports text, cotations and school level correctly', async () => {
  const values = { 'Nom-et-prenom-de-l-eleve': 'DUPONT Léo', 'Numero-dossier-MDPH': 'TEST-123', Lire: 'D', 'Fixer-son-attention': 'C', Personne1: 'Mme', PAI: true, Scolarite: '#1', 'Communication_Cadre1': 'Texte historique.' };
  const bytes = await exporter.build(template, values, { flatten: false });
  const allowed = new Set(Object.keys((await exporter.inspect(template)).fields));
  const result = await importer.readFields(bytes, allowed);
  assert.equal(result['Numero-dossier-MDPH'], 'TEST-123'); assert.equal(result.Lire, 'D'); assert.equal(result['Fixer-son-attention'], 'C');
  assert.equal(result.Personne1, 'Mme'); assert.equal(result.PAI, true); assert.equal(result.Scolarite, '#1');
  assert.equal(result['Communication_Cadre1'], 'Texte historique.');
});
test('layout maps the administrative and commentary fields to the right pages', async () => {
  const layout = await importer.templateLayout(template);
  assert.equal(layout.pageCount, 8);
  assert.equal(layout.fields.find(f => f.name === 'Nom-et-prenom-de-l-eleve').page, 0);
  assert.equal(layout.fields.find(f => f.name === 'Communication_Cadre1').page, 3);
  assert.ok(layout.fields.length > 120);
});
test('radio export labels are read even when PDF appearance names are numeric', async () => {
  const P = require('../vendor/pdf-lib.min.js');
  const pdf = await P.PDFDocument.create(); const page = pdf.addPage();
  const radio = pdf.getForm().createRadioGroup('Lire');
  radio.addOptionToPage('D', page, { x:20,y:20,width:12,height:12 }); radio.select('D');
  const values = await importer.readFields(await pdf.save(), new Set(['Lire']));
  assert.equal(values.Lire, 'D');
});
test('geometric extraction excludes text from adjacent fields', () => {
  const text = importer.textInBox([{ text: 'DUPONT', x: 20, y: 20 }, { text: 'Léo', x: 60, y: 20 }, { text: '.........', x: 15, y: 21 }, { text: 'AUTRE', x: 200, y: 20 }], { x: 10, y: 10, width: 100, height: 20 });
  assert.equal(text, 'DUPONT Léo');
  assert.equal(importer.textInBox([{ text: '25', x: 280, y: 625, width: 8 }, { text: '/ 20', x: 293, y: 625, width: 14 }], { x: 279, y: 622, width: 14, height: 9 }), '25');
});
test('OCR field normalization discards dotted leaders and invalid contact guesses', () => {
  assert.equal(importer.cleanOcrField('Numero-dossier-MDPH', 'TEST-IMPORT-001_'), 'TEST-IMPORT-001');
  assert.equal(importer.cleanOcrField('Nom-et-prenom-de-l-eleve', 'EXEMPLE Camille.....'), 'EXEMPLE Camille');
  assert.equal(importer.cleanOcrField('Code-postal', 'SO ere rar'), '');
  assert.equal(importer.cleanOcrField('Courriel', 'illisible'), '');
  assert.equal(importer.cleanOcrField('Date-naissance_Jour', '0 4'), '04');
});
test('labelled scan text recovers whole dates and names without adjacent labels', () => {
  const text = "Pour l’année scolaire 2025 /2026 Date de réunion de l’équipe de suivi de la scolarisation 12_/ 03 /2026_\nNom et prénom de l’élève : EXEMPLE Camille... Date de naissance: 04/06 /2017_\nÉtablissement scolaire fréquenté : École Exemple Classe fréquentée: CE1";
  const v = importer.normalize(importer.extractLabelled(text));
  assert.equal(v._nom, 'EXEMPLE'); assert.equal(v._prenom, 'Camille');
  assert.equal(v._naissance, '2017-06-04'); assert.equal(v._dateEss, '2026-03-12');
  assert.equal(v._annee, '2025-2026'); assert.equal(v['Etablissement-scolaire'], 'École Exemple');
});
test('historical context pseudonymizes both former and current identities and omits raw OCR', () => {
  const script = fs.readFileSync(path.join(__dirname, '../geva-workflows.js'), 'utf8');
  const pseudoFunctions = html.slice(html.indexOf('function pseudoMap('), html.indexOf('function unpseudo('));
  const sandbox = {
    GROUPS: groups, AREAS: {}, GevaGuidance: guidance,
    document: { querySelector: () => ({ addEventListener() {} }) },
  };
  vm.createContext(sandbox);
  vm.runInContext(pseudoFunctions + '\n' + script, sandbox);
  const student = { v: { _nom: 'ACTUEL', _prenom: 'Camille' }, baseline: { year: '2025-2026', values: { _nom: 'ANCIEN', _prenom: 'Camille', Lire: 'D', [groups.g5.c1]: 'Camille ANCIEN travaille avec EXEMPLE Parent, famille@example.fr, 06 01 02 03 04.' }, sourceIdentity: { 'Personne1_Nom-ligne1': 'EXEMPLE Parent' }, rawText: 'CONTENU OCR NON DESTINÉ AU MODÈLE' } };
  sandbox.student = student;
  sandbox.field = groups.g5.c1;
  const result = vm.runInContext('historicalContext(student, field)', sandbox);
  assert.match(result, /éléments historiques/);
  assert.match(result, /ancienne cotation D ; actuelle non renseignée/);
  assert.doesNotMatch(result, /Camille|ANCIEN|EXEMPLE|famille@example|06 01|CONTENU OCR/);
});
