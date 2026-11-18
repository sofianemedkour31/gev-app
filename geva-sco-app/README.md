# GEVA-Sco · Réexamen — application ULIS

Saisie du GEVA-Sco « réexamen » élève par élève, aide à la rédaction par l'API Albert, export du **formulaire officiel** (GEVA-Sco v2, décembre 2014) rempli.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Application (aucune compilation) |
| `geva-export.js` | Remplissage des 187 champs du PDF officiel, ajustement de la police aux cadres |
| `geva-sco-reexamen.pdf` | Formulaire officiel servant de gabarit |
| `vendor/pdf-lib.min.js` | Bibliothèque PDF (embarquée : fonctionne sans CDN) |
| `api/albert.js` | Relais Vercel vers Albert (la clé ne quitte pas le serveur) |
| `test/` | Tests Node de l'export (`NODE_PATH=… node test/build-test.js`) |

## Déploiement Vercel

1. Pousser ce dossier sur GitHub (ou `vercel` en ligne de commande), projet **sans framework** (« Other »), aucune commande de build.
2. Variables d'environnement :
   - `ALBERT_API_KEY` — obligatoire (la même que pour l'appli PPI convient) ;
   - `ALBERT_MODEL` — facultatif, `albert-large` par défaut (repli automatique sur le premier modèle de chat disponible si ce nom disparaît du catalogue) ;
   - `APP_TOKEN` — facultatif : si défini, saisir le même jeton dans Paramètres de l'appli.
3. Ouvrir l'URL, puis Paramètres › Tester la connexion.

En local : `npx serve .` (l'aide Albert nécessite le relais ; sans lui, saisie et export fonctionnent).

## Données

- Stockage dans le navigateur (localStorage). Sauvegarde/restauration en `.json` via le menu ⋯.
- Les notes rapides ne sont jamais exportées dans le PDF.
- Avant chaque appel à Albert : prénom, nom de l'élève et noms des responsables légaux remplacés par `[ÉLÈVE]`, `[PARENT1]`…, courriels et téléphones masqués ; restitution locale à la réception.

## Export

- « Exporter le PDF » : PDF figé, pour impression ou envoi.
- « PDF modifiable » (menu ⋯) : champs toujours modifiables dans Acrobat.
- Police à 9 pt dans les zones multilignes, réduite jusqu'à 6 pt si nécessaire ; au-delà, le texte est coupé : la jauge sous chaque cadre et la section « Vérification » le signalent avant l'export.
