import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { requestJSON } from '../lib/client-request';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('returns parsed JSON from a same-origin POST without an undefined payload', async () => {
  globalThis.fetch = async (path, init) => {
    assert.equal(path, '/api/workouts');
    assert.equal(init?.method, 'POST');
    assert.ok(init?.credentials === undefined || init.credentials === 'same-origin');
    assert.equal(init?.body, undefined);
    assert.equal(new Headers(init?.headers).has('Content-Type'), false);
    return Response.json({ saved: true });
  };
  assert.deepEqual(await requestJSON('/api/workouts'), { saved: true });
});

test('replaces rejected network errors with actionable Japanese text', async () => {
  for (const cause of [new TypeError('Failed to fetch: internal detail'), new Error('secret stack'), 'offline']) {
    globalThis.fetch = async () => { throw cause; };
    await assert.rejects(requestJSON('/api/workouts'), {
      name: 'Error',
      message: '通信できませんでした。接続を確認して、もう一度お試しください。',
    });
  }
});

test('preserves nonempty server error strings, including HTTP 401', async () => {
  for (const status of [400, 401, 422, 500]) {
    globalThis.fetch = async () => Response.json({ error: '  入力内容を確認してください。  ' }, { status });
    await assert.rejects(requestJSON('/api/workouts'), {
      name: 'Error', message: '  入力内容を確認してください。  ',
    });
  }
});

test('uses a Japanese HTTP status error for unusable JSON error values', async () => {
  for (const body of [{}, null, [], 'internal detail', false, 0, ...[null, false, 0, '', '  ', 123, {}, []].map(error => ({ error }))]) {
    globalThis.fetch = async () => Response.json(body, { status: 403 });
    await assert.rejects(requestJSON('/api/workouts'), {
      name: 'Error', message: 'リクエストに失敗しました（HTTP 403）。',
    });
  }
});

test('never exposes invalid error response bodies or HTTP status text', async () => {
  for (const status of [401, 502]) {
    for (const body of ['<html>secret stack trace</html>', '', '{broken']) {
      globalThis.fetch = async () => new Response(body, { status, statusText: 'private infrastructure detail' });
      await assert.rejects(requestJSON('/api/workouts'), {
        name: 'Error', message: `リクエストに失敗しました（HTTP ${status}）。`,
      });
    }
  }
});

test('warns that an invalid successful response may already have been saved', async () => {
  for (const status of [200, 201]) {
    for (const body of ['<html>private trace</html>', '', '{broken']) {
      globalThis.fetch = async () => new Response(body, { status });
      await assert.rejects(requestJSON('/api/workouts'), {
        name: 'Error',
        message: 'サーバーの応答を確認できませんでした。保存済みの可能性があるため、再送信前に画面を更新してください。',
      });
    }
  }
});

test('accepts HTTP 204 without attempting to parse an absent body', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await requestJSON('/api/workouts', undefined, 'PUT'), undefined);
});

test('serializes every defined payload as JSON for POST and PUT', async () => {
  for (const method of ['POST', 'PUT'] as const) {
    for (const payload of [{ weight: 80 }, null, false, 0, '']) {
      globalThis.fetch = async (path, init) => {
        assert.equal(path, '/api/workouts');
        assert.equal(init?.method, method);
        assert.equal(init?.body, JSON.stringify(payload));
        assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/json');
        return Response.json(payload);
      };
      assert.deepEqual(await requestJSON('/api/workouts', payload, method), payload);
    }
  }
});
