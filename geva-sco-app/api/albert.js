/*
 * Relais Vercel vers l'API Albert (DINUM).
 * La clé reste côté serveur : le navigateur n'envoie que des textes pseudonymisés.
 *
 * Variables d'environnement (Vercel › Settings › Environment Variables) :
 *   ALBERT_API_KEY   (obligatoire)  clé Albert API
 *   ALBERT_MODEL     (facultatif)   par défaut « albert-large »
 *   ALBERT_BASE_URL  (facultatif)   par défaut https://albert.api.etalab.gouv.fr/v1
 *   APP_TOKEN        (facultatif)   si défini, l'appli doit envoyer ce jeton (Paramètres › jeton d'accès)
 *
 * Contrat : POST { messages:[{role,content}], temperature?, max_tokens? } → { text }
 */
const BASE = (process.env.ALBERT_BASE_URL || 'https://albert.api.etalab.gouv.fr/v1').replace(/\/$/, '');
let fallbackModel = null;

async function complete(model, body) {
  return fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ALBERT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, model, stream: false }),
  });
}

// Si le modèle configuré n'existe pas (catalogue Albert mis à jour), on prend le premier modèle de chat disponible.
async function firstChatModel() {
  if (fallbackModel) return fallbackModel;
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${process.env.ALBERT_API_KEY}` } });
  if (!r.ok) return null;
  const data = await r.json();
  const m = (data.data || []).find(x => x.type === 'text-generation');
  return (fallbackModel = m ? m.id : null);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'méthode non autorisée' });
  if (!process.env.ALBERT_API_KEY) return res.status(500).json({ error: 'ALBERT_API_KEY non configurée sur Vercel' });
  if (process.env.APP_TOKEN && req.headers['x-app-token'] !== process.env.APP_TOKEN) {
    return res.status(401).json({ error: 'jeton d’accès au relais incorrect (Paramètres)' });
  }

  const { messages, temperature = 0.3, max_tokens = 1200 } = req.body || {};
  const valid = Array.isArray(messages) && messages.length > 0 && messages.length <= 12 &&
    messages.every(m => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string');
  const size = valid ? messages.reduce((n, m) => n + m.content.length, 0) : 0;
  if (!valid || size > 30000) return res.status(400).json({ error: 'requête invalide' });

  const body = {
    messages,
    temperature: Math.min(1, Math.max(0, Number(temperature) || 0.3)),
    max_tokens: Math.min(2000, Math.max(10, Number(max_tokens) || 1200)),
  };

  try {
    let model = process.env.ALBERT_MODEL || 'albert-large';
    let r = await complete(model, body);
    if (r.status === 404 || r.status === 422) {
      const alt = await firstChatModel();
      if (alt && alt !== model) { model = alt; r = await complete(model, body); }
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = data.detail || data.error?.message || data.error || '';
      return res.status(502).json({ error: `Albert a répondu ${r.status}${detail ? ' : ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 200) : ''}` });
    }
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      const error = choice?.finish_reason === 'length'
        ? 'Albert a atteint la limite de génération avant de produire une réponse. Réessayez.'
        : 'Albert n’a renvoyé aucun texte. Réessayez.';
      return res.status(502).json({ error });
    }
    return res.status(200).json({ text, model });
  } catch (err) {
    return res.status(502).json({ error: 'Albert injoignable : ' + err.message });
  }
};
