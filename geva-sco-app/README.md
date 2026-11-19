# GEVA-Sco · Réexamen — application ULIS

Saisie du GEVA-Sco « réexamen » élève par élève, aide à la rédaction par l'API Albert, export du **formulaire officiel** (GEVA-Sco v2, décembre 2014) rempli.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Application (aucune compilation) |
| `geva-export.js` | Remplissage des 187 champs du PDF officiel, ajustement de la police aux cadres |
| `geva-guidance.js` | Questions propres à chaque activité et sélection selon les cotations |
| `geva-import.js` | Lecture locale des PDF, reconnaissance des scans et normalisation des champs |
| `geva-workflows.js` | Relecture de l’import, référence historique et questions contextualisées |
| `geva-sco-reexamen.pdf` | Formulaire officiel servant de gabarit |
| `vendor/pdf-lib.min.js` | Bibliothèque PDF (embarquée : fonctionne sans CDN) |
| `api/albert.js` | Relais Vercel vers Albert (la clé ne quitte pas le serveur) |
| `test/` | Tests Node : `node --test test/*-test.js` et `node test/build-test.js` |

## Déploiement Vercel

Le dépôt [sofianemedkour31/gev-app](https://github.com/sofianemedkour31/gev-app) est relié au projet Vercel **gev-app**. Les envois sur `main` déclenchent le déploiement de production sur [gev-app.vercel.app](https://gev-app.vercel.app).

1. Configuration Vercel : dossier racine `geva-sco-app`, projet **sans framework** (« Other »), aucune commande de build.
2. Variables d'environnement :
   - `ALBERT_API_KEY` — obligatoire (la même que pour l'appli PPI convient) ;
   - `ALBERT_MODEL` — facultatif, `albert-large` par défaut (repli automatique sur le premier modèle de chat disponible si ce nom disparaît du catalogue) ;
   - `APP_TOKEN` — facultatif : si défini, saisir le même jeton dans Paramètres de l'appli.
3. Après l'ajout de `ALBERT_API_KEY` dans l'environnement **Production**, relancer le déploiement depuis Vercel pour appliquer la variable. Ajouter aussi la clé à **Preview** pour utiliser Albert dans les aperçus.
4. Ouvrir l'URL, puis Paramètres › Tester la connexion.

En local : `npx serve .` (l'aide Albert nécessite le relais ; sans lui, saisie et export fonctionnent).

## Données

- Stockage dans le navigateur (localStorage). Sauvegarde/restauration en `.json` via le menu ⋯.
- Les notes rapides ne sont jamais exportées dans le PDF.
- Avant chaque appel à Albert : prénom, nom de l'élève et noms des responsables légaux remplacés par `[ÉLÈVE]`, `[PARENT1]`…, courriels et téléphones masqués ; restitution locale à la réception.

## Questions guidées

- Les questions de chaque tableau utilisent uniquement ses activités cotées, avec priorité aux C et D, puis aux B. Les A servent aux points d’appui ; « sans objet » et les activités non cotées ne sont pas assimilées à des difficultés.
- Les questions du cadre 1 explorent les obstacles ; celles du cadre 2 explorent les aides, les conditions favorables et l’autonomie.
- Une base de questions par activité reste disponible si Albert ne peut pas les adapter. Les questions déjà renseignées ne sont pas répétées tant que la cotation reste identique.
- L’enseignant répond sous les questions utiles, puis conserve ses réponses dans les notes ou demande une rédaction. Les questions sans réponse ne sont pas ajoutées comme observations.

## Importer un ancien GEVA-Sco

1. Cliquer sur **Importer un GEVA-Sco**, puis choisir un PDF (25 Mo et 20 pages maximum).
2. Vérifier les propositions avec le document original : identité, coordonnées et repères de l’ancien document. Les PDF modifiables sont lus par leurs champs. Les PDF figés sont lus par zones sur le modèle réexamen de huit pages. Les scans sont reconnus en français sur l’appareil ; les écritures manuscrites ou les images peu lisibles peuvent nécessiter une saisie manuelle.
3. Corriger les anciens commentaires et cotations utiles dans la partie dépliable. Les cases d’un PDF figé ou scanné ne sont pas déduites automatiquement.
4. Créer la fiche : seules les informations administratives vérifiées sont reprises dans le nouveau dossier. La classe, la date de la prochaine ESS, les cotations et les observations actuelles sont à renseigner. Aucune fiche existante n’est remplacée.
5. Consulter **Depuis le précédent GEVA-Sco** pour comparer les anciennes cotations avec celles d’aujourd’hui et poser des questions sur les évolutions. Les anciens textes sont identifiés comme historiques ; ils ne sont pas copiés automatiquement comme constats actuels.

PDF.js, Tesseract et les données de reconnaissance sont embarqués. Le document original et le texte OCR ne sont pas envoyés à un service externe. Seuls les extraits historiques utiles, pseudonymisés, accompagnent une demande explicite d’aide à Albert. La référence historique est incluse dans les sauvegardes JSON et reste hors du PDF officiel exporté.

## Export

- « Exporter le PDF » : PDF figé, pour impression ou envoi.
- « PDF modifiable » (menu ⋯) : champs toujours modifiables dans Acrobat.
- Police à 9 pt dans les zones multilignes, réduite jusqu'à 6 pt si nécessaire ; au-delà, le texte est coupé : la jauge sous chaque cadre et la section « Vérification » le signalent avant l'export.
