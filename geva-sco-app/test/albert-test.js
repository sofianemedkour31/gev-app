const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/albert.js');

async function request(choices, body = {}) {
  const originalFetch = global.fetch;
  const originalKey = process.env.ALBERT_API_KEY;
  process.env.ALBERT_API_KEY = 'test-only';
  const queue = Array.isArray(choices) ? choices : [choices];
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ body: JSON.parse(options.body), signal: options.signal });
    const choice = queue[Math.min(calls.length - 1, queue.length - 1)];
    if (choice instanceof Error) throw choice;
    return { ok: true, status: 200, json: async () => ({ choices: [choice] }) };
  };
  const result = { calls };
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  const headers = process.env.APP_TOKEN ? { 'x-app-token': process.env.APP_TOKEN } : {};
  try {
    await handler({ method: 'POST', headers, body: { messages: [{ role: 'user', content: 'Test' }], ...body } }, res);
    return result;
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ALBERT_API_KEY;
    else process.env.ALBERT_API_KEY = originalKey;
  }
}

test('returns the final answer from Albert', async () => {
  const result = await request({ message: { content: 'OK' }, finish_reason: 'stop' });
  assert.equal(result.status, 200);
  assert.equal(result.body.text, 'OK');
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].body.max_tokens, 5296);
});

test('retries an empty answer with a larger reasoning budget', async () => {
  const result = await request([
    { message: { content: '', reasoning_content: 'internal reasoning' }, finish_reason: 'length' },
    { message: { content: 'Proposition complète.' }, finish_reason: 'stop' },
  ]);
  assert.equal(result.status, 200);
  assert.equal(result.body.text, 'Proposition complète.');
  assert.deepEqual(result.calls.map(c => c.body.max_tokens), [5296, 10592]);
  assert.equal(result.calls[0].signal, result.calls[1].signal);
  assert.deepEqual(result.calls[0].body.messages, result.calls[1].body.messages);
  assert.doesNotMatch(JSON.stringify(result.body), /internal reasoning/);
});

test('retries partial answers instead of offering truncated text', async () => {
  const result = await request([
    { message: { content: '{"obstacles":"inachevé' }, finish_reason: 'length' },
    { message: { content: '{"obstacles":"Texte complet","appuis":"Aide visuelle"}' }, finish_reason: 'stop' },
  ], { max_tokens: 1400 });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body.text).appuis, 'Aide visuelle');
  assert.deepEqual(result.calls.map(c => c.body.max_tokens), [5496, 10992]);
});

test('stops after one retry and explains exhausted generation budget', async () => {
  const result = await request({ message: { content: '', reasoning_content: 'internal reasoning' }, finish_reason: 'length' });
  assert.equal(result.status, 502);
  assert.equal(result.calls.length, 2);
  assert.match(result.body.error, /seconde tentative/);
  assert.equal(result.body.text, undefined);
  assert.doesNotMatch(JSON.stringify(result.body), /internal reasoning/);
});

test('rejects missing and whitespace-only final answers', async () => {
  for (const content of [undefined, null, '   ']) {
    const result = await request({ message: { content }, finish_reason: 'stop' });
    assert.equal(result.status, 502);
    assert.match(result.body.error, /aucun texte/);
    assert.equal(result.calls.length, 1);
  }
});

test('caps untrusted token budgets and handles invalid values', async () => {
  for (const [max_tokens, expected] of [[1e9, 6096], ['invalid', 5296], [null, 4106]]) {
    const result = await request({ message: { content: 'OK' }, finish_reason: 'stop' }, { max_tokens });
    assert.equal(result.status, 200);
    assert.equal(result.calls[0].body.max_tokens, expected);
  }
});

test('returns an actionable error if the shared deadline expires', async () => {
  const error = new Error('deadline');
  error.name = 'TimeoutError';
  const result = await request([error]);
  assert.equal(result.status, 504);
  assert.match(result.body.error, /trop de temps/);
  assert.equal(result.calls.length, 1);
});
