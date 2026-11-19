export async function requestJSON(
  path: string,
  payload?: unknown,
  method: 'POST' | 'PUT' = 'POST',
): Promise<unknown> {
  const init: RequestInit = {
    method,
    ...(payload !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      : {}),
  };
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error('通信できませんでした。接続を確認して、もう一度お試しください。');
  }
  if (response.status === 204) return undefined;

  const httpError = `リクエストに失敗しました（HTTP ${response.status}）。`;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(response.ok
      ? 'サーバーの応答を確認できませんでした。保存済みの可能性があるため、再送信前に画面を更新してください。'
      : httpError);
  }
  if (!response.ok) {
    if (typeof data === 'object' && data !== null && 'error' in data
        && typeof data.error === 'string' && data.error.trim() !== '') {
      throw new Error(data.error);
    }
    throw new Error(httpError);
  }
  return data;
}
