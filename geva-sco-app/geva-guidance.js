(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GevaGuidance = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RATINGS = { A: 'réalisée sans difficulté et seul', B: 'difficultés ou aide ponctuelles', C: 'difficultés ou aide régulières', D: 'activité non réalisée', SO: 'sans objet' };
  // Une paire par activité : observer les obstacles / rechercher les appuis.
  const BANK = {
    'Orientation-dans-le-temps': ['Quels repères temporels posent difficulté : début, fin, succession des activités ou anticipation des changements ?', 'Quels repères ou rituels aident à se situer dans le déroulement de la journée ?'],
    'Orientation-dans-l-espace': ['Dans quels lieux ou trajets scolaires le repérage pose-t-il difficulté ?', 'Quels repères visuels ou accompagnements facilitent les trajets dans les lieux scolaires ?'],
    'Fixer-son-attention': ['Dans quelles activités et à quels moments l’attention se disperse-t-elle, et quel rappel est nécessaire ?', 'Quelles différences observes-tu avec une consigne courte, un support visuel, une pause ou un environnement moins stimulant ?'],
    'Memoriser': ['Quelles informations sont difficiles à retenir ou à retrouver après un délai ?', 'Quels rappels, répétitions ou supports permettent de retrouver une information déjà travaillée ?'],
    'Gerer-sa-securite': ['Dans quelles situations scolaires un rappel ou une surveillance sont-ils nécessaires pour la sécurité ?', 'Quels repères ou accompagnements aident à identifier un risque et à agir en sécurité ?'],
    'Respecter-les-regles-de-vie': ['Quelles règles nécessitent un rappel, dans quelles situations et à quelle fréquence ?', 'Quelles règles sont respectées de façon autonome, et quels repères facilitent les autres ?'],
    'Relations-avec-autrui': ['Dans quelles interactions avec les pairs ou les adultes observes-tu une difficulté concrète ?', 'Dans quelles situations les échanges avec les autres se déroulent-ils le mieux, et avec quels appuis ?'],
    'Maitriser-son-comportement': ['Qu’observes-tu lors des désaccords, de l’attente ou des changements, et quelles conséquences sur la participation ?', 'Quels moyens ou interventions aident à retrouver une disponibilité pour l’activité et les échanges ?'],
    'Faire-ses-transferts': ['Comment se déroule le passage entre deux assises, et quelle aide humaine ou matérielle est nécessaire ?', 'Quels aménagements ou gestes permettent de participer au transfert avec le plus d’autonomie possible ?'],
    'Se-deplacer': ['Quels déplacements scolaires posent difficulté, selon la distance, les obstacles ou les lieux ?', 'Quels trajets sont accessibles, et quels aménagements ou accompagnements facilitent les autres ?'],
    'Utiliser-les-transports-communs': ['Quelles étapes du trajet en transport nécessitent une aide : repérage, attente, montée ou descente ?', 'Quels repères ou accompagnements facilitent l’utilisation du transport lorsque cette activité est concernée ?'],
    'Activites-de-motricite': ['Quels gestes de manipulation posent difficulté, avec quels objets et dans quelles activités ?', 'Quels outils, positions ou adaptations facilitent les gestes fins et la manipulation ?'],
    'Assurer-l-elimination': ['Quelles étapes de l’utilisation des toilettes nécessitent une aide ou un rappel à l’école ?', 'Quels repères, aménagements ou accompagnements favorisent l’autonomie aux toilettes ?'],
    'S-habiller-se-deshabiller': ['Quelles étapes de l’habillage ou du déshabillage demandent une aide, et à quels moments scolaires ?', 'Quels gestes d’habillage sont réalisés seul, et quels vêtements ou repères facilitent les autres ?'],
    'Prendre-ses-repas': ['Dans quelles situations du repas une aide est-elle nécessaire, et pour quels gestes observables ?', 'Quels ustensiles, aménagements ou accompagnements favorisent la participation au repas ?'],
    'Prendre-soin-de-sa-sante': ['Quels gestes de soin ou d’hygiène à l’école nécessitent une aide ou un rappel, sans préciser de diagnostic ?', 'Quels repères et accompagnements permettent de participer aux gestes de soin ou d’hygiène à l’école ?'],
    'Parler': ['Dans quelles situations l’expression orale limite-t-elle la possibilité de se faire comprendre ?', 'Avec quels interlocuteurs, supports ou modalités l’expression est-elle la plus accessible ?'],
    'Comprendre-la-parole': ['Qu’observes-tu lors d’un échange oral en face à face lorsque le message n’est pas compris ?', 'La compréhension varie-t-elle avec un interlocuteur proche, un débit ralenti ou une reformulation ?'],
    'Comprendre-une-phrase-simple': ['Quels types de phrases simples nécessitent une reformulation ou un appui pour être compris ?', 'Quels gestes, images ou exemples facilitent la compréhension d’une phrase simple ?'],
    'Produire-recevoir-des-messages-non-verbaux': ['Quels gestes, regards, expressions ou pictogrammes sont difficiles à comprendre ou à utiliser ?', 'Quels moyens non verbaux sont compris ou utilisés pour communiquer, et dans quelles situations ?'],
    'Lire': ['Qu’observes-tu lorsqu’une tâche de lecture est proposée : engagement, identification des mots ou compréhension ?', 'As-tu observé une différence avec des mots connus, des images, un texte adapté ou une lecture par l’adulte ?'],
    'Ecrire': ['Quelle étape de l’écriture pose difficulté : tracer, copier, encoder ou produire un message ?', 'Quels supports, outils ou modalités permettent de produire une trace écrite, même partielle ?'],
    'Calculer': ['Quelles tâches numériques posent difficulté : dénombrer, reconnaître les nombres, calculer ou résoudre un problème ?', 'Quelles procédures, manipulations ou représentations facilitent les activités numériques ?'],
    'Organiser-son-travail': ['À quelles étapes de l’organisation du travail une relance est-elle nécessaire : commencer, préparer ou enchaîner ?', 'Quels plans de travail, repères d’étapes ou routines aident à organiser l’activité ?'],
    'Controler-son-travail': ['Comment se déroule la vérification d’un travail, et que faut-il guider pour repérer une erreur ?', 'Quels exemples, critères ou outils permettent de vérifier et de corriger son travail ?'],
    'Accepter-des-consignes': ['Que se passe-t-il au moment où une consigne est proposée, et dans quelles situations l’engagement est-il difficile ?', 'Quelles modalités de présentation ou de choix facilitent l’entrée dans une tâche proposée ?'],
    'Suivre-des-consignes': ['Quelles étapes d’une consigne ne sont pas réalisées sans aide : retenir, commencer ou poursuivre ?', 'Une consigne fractionnée, illustrée ou reformulée modifie-t-elle la réalisation de l’activité ?'],
    'S-installer-dans-la-classe': ['Quelles étapes de l’installation en classe demandent une aide : trouver sa place, préparer ou disposer le matériel ?', 'Quels repères de place, routines ou aménagements facilitent une installation autonome ?'],
    'Utiliser-des-supports-pedagogiques': ['Quelles difficultés observes-tu pour se repérer dans une page ou utiliser un support pédagogique ?', 'Quels formats, présentations ou adaptations de supports facilitent l’accès au travail ?'],
    'Utiliser-du-materiel-adapte-a-son-handicap': ['Quelles étapes de l’utilisation du matériel adapté nécessitent une aide ou limitent l’accès à l’activité ?', 'Dans quelles activités le matériel adapté apporte-t-il un appui, et avec quel accompagnement ?'],
    'Prendre-des-notes': ['Qu’observes-tu lorsqu’il faut conserver une information par une prise de notes, quel que soit le support ?', 'Quels supports ou aides permettent de garder une trace utile et de la retrouver ?'],
    'Participer-a-des-sorties-scolaires': ['Quelles étapes d’une sortie scolaire limitent la participation : trajet, repérage, rythme ou accès aux activités ?', 'Quels aménagements et accompagnements rendent les sorties scolaires plus accessibles ?'],
  };
  function groupFor(groups, field) {
    return Object.values(groups).find(g => g.c1 === field || g.c2 === field) || null;
  }
  function context(groups, field, values) {
    const g = groupFor(groups, field);
    if (!g) return '';
    return [`Thème exclusif : ${g.title}.`, `Cadre demandé : ${g.c1 === field ? 'obstacles observables' : 'points d’appui et conditions de réussite'}.`,
      ...g.rows.map(([key, label]) => `${label} : ${RATINGS[values[key]] ? values[key] + ' — ' + RATINGS[values[key]] : 'non cotée (ne rien déduire)'}.`),
      g.bati ? `Accessibilité du bâti : ${values['Accessibilite-du-bati'] || 'non renseignée'}.` : '',
      'Une cotation ne décrit pas la cause d’une difficulté. D signifie activité non réalisée, sans préjuger du motif. Ne pas inventer d’observation.'].filter(Boolean).join('\n');
  }
  function candidates(groups, field, values, answered = {}, previous = {}) {
    const g = groupFor(groups, field);
    if (!g) return [];
    const obstacles = g.c1 === field;
    const order = obstacles ? ['D', 'C', 'B'] : ['C', 'D', 'B', 'A'];
    return g.rows.map(([activity, label], index) => {
      const historicalOnly = !RATINGS[values[activity]] && RATINGS[previous[activity]];
      const cote = historicalOnly ? previous[activity] : values[activity];
      if (!order.includes(cote) || !BANK[activity]) return null;
      const id = `${activity}:${cote}:${obstacles ? 'obstacles' : 'appuis'}${historicalOnly ? ':historique' : ''}`;
      const alternateId = historicalOnly ? id.replace(/:historique$/, '') : id + ':historique';
      if (answered[id]?.answer?.trim() || answered[alternateId]?.answer?.trim()) return null;
      let question = BANK[activity][obstacles ? 0 : 1];
      if (cote === 'A') question = `Comment cette activité (« ${label.toLowerCase()} ») est-elle réalisée sans aide, et dans quelles conditions ?`;
      const prior = previous[activity];
      if (RATINGS[prior] && prior !== 'SO') question += ` Au précédent GEVA-Sco, la cotation était ${prior} : qu’est-ce qui a changé ou reste comparable aujourd’hui ?`;
      return { id, activity, label, cote, historicalOnly: !!historicalOnly, question, rank: order.indexOf(cote), index };
    }).filter(Boolean).sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, 6);
  }
  function validateQuestions(data, selected) {
    if (!Array.isArray(data?.questions)) return null;
    const byId = new Map(selected.map(q => [q.id, q]));
    const seen = new Set();
    const result = [];
    for (const item of data.questions) {
      const base = byId.get(item?.id);
      if (!base || seen.has(base.id) || typeof item.question !== 'string' || !item.question.trim() || item.question.length > 650) return null;
      seen.add(base.id);
      result.push({ ...base, question: item.question.trim() });
    }
    return result.length === selected.length ? result : null;
  }
  function evolutionQuestions(groups, values, previous, answered = {}) {
    const questions = [];
    const priority = ['D','C','B','A'];
    for (const group of Object.values(groups)) for (const [activity, label] of group.rows) {
      const before = previous[activity], now = values[activity];
      if (!RATINGS[before] || before === 'SO' || now === 'SO') continue;
      const id = `evolution:${activity}:${before}:${RATINGS[now] ? now : 'non-cote'}`;
      if (answered[id]?.answer?.trim()) continue;
      const question = !RATINGS[now]
        ? `Au précédent GEVA-Sco, « ${label.toLowerCase()} » était coté ${before}. Qu’observes-tu aujourd’hui dans cette activité : changements, stabilité ou nouvelles difficultés, et dans quelles situations ?`
        : before === now
          ? `« ${label} » est coté ${now} dans les deux documents. Les situations observées, les conditions de réalisation et l’autonomie sont-elles comparables aujourd’hui ?`
          : `Pour « ${label.toLowerCase()} », l’ancienne cotation était ${before} et l’actuelle est ${now}. Quels constats actuels expliquent cette différence, et les conditions de réalisation sont-elles comparables ?`;
      questions.push({ id, activity, label, cote: RATINGS[now] ? now : before, historicalOnly: !RATINGS[now], question, rank: priority.indexOf(RATINGS[now] ? now : before) });
    }
    questions.sort((a,b) => a.rank - b.rank);
    const selected = questions.slice(0,4);
    for (const [groupId, group] of Object.entries(groups)) {
      if (!previous[group.c1] && !previous[group.c2]) continue;
      const id = `evolution:appuis:${groupId}`;
      if (answered[id]?.answer?.trim()) continue;
      selected.push({ id, activity: group.c2, label: group.title, question: `Parmi les appuis ou conditions décrits dans les anciens commentaires de ce tableau, lesquels sont encore utilisés aujourd’hui ? Qu’observes-tu avec ces aides, et qu’est-ce qui a été ajusté ?` });
      if (selected.length >= 6) break;
    }
    return selected.slice(0,6);
  }
  return { BANK, RATINGS, groupFor, context, candidates, validateQuestions, evolutionQuestions };
});
