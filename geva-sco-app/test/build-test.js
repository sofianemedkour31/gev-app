const fs=require('fs');
const G=require('../geva-export.js');
const tpl=fs.readFileSync(__dirname+'/../geva-sco-reexamen.pdf');
const long='L’élève entre dans l’activité lorsque la consigne est reformulée oralement et accompagnée d’un exemple. Il a besoin d’un étayage régulier pour planifier les étapes → il s’appuie sur un plan de travail visuel. ';
const v={
 'Numero-dossier-MDPH':'59-2021-004512','Annee-scolaire-debut':'26','Annee-scolaire-fin':'27',
 'Date-reunion_Jour':'12','Date-reunion_Mois':'03','Date-reunion_Annee':'27',
 'Nom-et-prenom-de-l-eleve':'DUPONT Léo','Nom-eleve':'DUPONT Léo','Date-naissance_Jour':'04','Date-naissance_Mois':'06','Date-naissance_Annee':'2017',
 'Numero-et-rue':'12 rue des Lilas','Ville':'Lille','Code-postal':'59000','Tel':'06 00 00 00 00','Courriel':'famille@example.fr',
 'Personne1':'Mme','Personne1_Nom-ligne1':'DUPONT Sarah','Personne2':'M','Personne2_Nom-ligne1':'DUPONT Karim',
 'Coordonnees-enseignant_Nom':'Mme X, enseignante référente secteur Lille-Centre',
 'Etablissement-scolaire':'École Soubise – ULIS école','Classe-frequentee':'CE1 + ULIS',
 'Parcours-de-scolarisation_Annee1':'2020-2021','Parcours-de-scolarisation_Scolarisation1':'PS – école maternelle, temps partiel',
 'PAI':true,'SESSAD':true,'CMP':true,'Accompagnement-soins_Commentaires':long,
 'Plan-projets-formalises_Commentaires':'PAI asthme depuis 2022.',
 'Amenagements-adaptations-pedagogiques':true,'Conditions-materielles_Commentaires':long.repeat(2),
 'Niveau-d-enseignement-dans-les-apprentissages':'Français : CP (décodage en cours). Mathématiques : CE1.','Scolarite':'#1',
 'Lundi-matin':'Classe de référence CE1\n8h30-10h : regroupement ULIS','Lundi-midi':'Cantine','Lundi-apres-midi':'SESSAD 14h-15h',
 'Samedi-matin':'—',
 'Orientation-dans-le-temps':'C','Orientation-dans-l-espace':'B','Fixer-son-attention':'D','Memoriser':'A','Faire-ses-transferts':'SO',
 'Taches-et-exigences-generales-relation-avec-autrui_Cadre':long,'Taches-et-exigences-generales-relation-avec-autrui_Cadre2':long.repeat(4),
 'Accessibilite-du-bati':'Partielle','Lire':'C','Ecrire':'D','Calculer':'B','Participer-a-des-sorties-scolaires':'A',
 'Taches-et-exigences-relation-scolarite_Cadre1':long,'Evolutions-observées-et-persepectives-projet-professionnel':long.repeat(3),
 'Amenagements-et-adaptations-pedagogiques':long.repeat(3),'Objectifs-pedagogiques-et-axes-a-travailler-pour-suite-parcours':long.repeat(6),
 'Participant1':'Mme X','Fonction1':'Enseignante référente','Participant2':'M. Medkour','Fonction2':'Coordonnateur ULIS',
};
(async()=>{
 const info=await G.inspect(tpl);
 console.log('fields',Object.keys(info.fields).length);
 const b=info.fields['Taches-et-exigences-generales-relation-avec-autrui_Cadre2'].boxes[0];
 console.log('fit cadre2 x4', G.fit(long.repeat(4),b,info.font,true));
 console.log('fit cadre2 x12', G.fit(long.repeat(12),b,info.font,true));
 fs.writeFileSync(__dirname+'/out-flat.pdf', await G.build(tpl,v,{flatten:true}));
 fs.writeFileSync(__dirname+'/out-form.pdf', await G.build(tpl,v,{flatten:false}));
 console.log('ok');
})().catch(e=>{console.error(e);process.exit(1)});
