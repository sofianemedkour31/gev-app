const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/albert.js');

async function request(choice) {
  const originalFetch = global.fetch;
  const originalKey = process.env.ALBERT_API_KEY;
  process.env.ALBERT_API_KEY = 'test-only';
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [choice] }) });
  const result = {};
  const res = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  const headers = process.env.APP_TOKEN ? { 'x-app-token': process.env.APP_TOKEN } : {};
  try {
    await handler({ method: 'POST', headers, body: { messages: [{ role: 'user', content: 'Test' }] } }, res);
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
});

test('reports exhausted generation budget instead of a successful empty answer', async () => {
  const result = await request({ message: { content: '', reasoning_content: 'internal reasoning' }, finish_reason: 'length' });
  assert.equal(result.status, 502);
  assert.match(result.body.error, /limite de génération/);
  assert.equal(result.body.text, undefined);
  assert.doesNotMatch(JSON.stringify(result.body), /internal reasoning/);
});

test('rejects missing and whitespace-only final answers', async () => {
  for (const content of [undefined, null, '   ']) {
    const result = await request({ message: { content }, finish_reason: 'stop' });
    assert.equal(result.status, 502);
    assert.match(result.body.error, /aucun texte/);
  }
});
