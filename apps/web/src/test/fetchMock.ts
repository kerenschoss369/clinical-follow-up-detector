import type { Mock } from 'vitest';

export function jsonResponse(
  status: number,
  body: unknown,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function deferredResponse(): {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
} {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

export function getPatchCalls(fetchMock: Mock): Array<{
  url: string;
  body: unknown;
}> {
  return fetchMock.mock.calls
    .filter(([url, init]) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      return requestUrl.includes('/api/actions/') && init?.method === 'PATCH';
    })
    .map(([url, init]) => ({
      url: typeof url === 'string' ? url : String(url),
      body: JSON.parse(String(init?.body ?? '{}')),
    }));
}

export function getLastPatchBody(fetchMock: Mock): unknown {
  const calls = getPatchCalls(fetchMock);
  return calls.at(-1)?.body;
}
