# Bibliothèques embarquées pour l’import

Ces fichiers sont servis par l’application. Les PDF, les images et le texte reconnu
ne sont pas envoyés à un service de reconnaissance externe.

- PDF.js / pdfjs-dist **6.5.438**, Mozilla, Apache-2.0. Source npm officielle :
  https://registry.npmjs.org/pdfjs-dist/6.5.438
- Tesseract.js **6.0.1**, Apache-2.0. Source npm officielle :
  https://registry.npmjs.org/tesseract.js/6.0.1
- Tesseract.js-core **6.1.2**, Apache-2.0. Source npm officielle :
  https://registry.npmjs.org/tesseract.js-core/6.1.2
- Données françaises **@tesseract.js-data/fra 1.0.0**, entraînement Tesseract,
  Apache-2.0 : https://github.com/naptha/tessdata

Les archives npm ont été contrôlées avec leur empreinte d’intégrité avant extraction.
Les licences des bibliothèques sont conservées dans leurs dossiers respectifs.
Les ressources OCR sont chargées uniquement lorsqu’un scan doit être reconnu.
