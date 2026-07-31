import { WafBridge } from '../bridge';

/** Flush microtask queue so the awaited readyPromise inside send() settles */
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

function extractCommand(injectedJs: string): { type: string; requestId: string; [key: string]: unknown } {
  const match = injectedJs.match(/data: ("(?:\\.|[^"\\])*")/);
  if (!match) throw new Error('Could not extract command from: ' + injectedJs);
  return JSON.parse(JSON.parse(match[1]));
}

describe('WafBridge', () => {
  let bridge: WafBridge;
  let injectedCalls: string[];

  beforeEach(() => {
    bridge = new WafBridge();
    injectedCalls = [];
    bridge.setInjector((js: string) => {
      injectedCalls.push(js);
    });
    // Mark bridge as ready
    bridge.handleMessage(JSON.stringify({ type: 'ready' }));
  });

  describe('getToken', () => {
    it('resolves when resolve event is received', async () => {
      const promise = bridge.getToken(1000);
      await flush();

      expect(injectedCalls).toHaveLength(1);
      const cmd = extractCommand(injectedCalls[0]);
      expect(cmd.type).toBe('getToken');

      bridge.handleMessage(
        JSON.stringify({ type: 'resolve', requestId: cmd.requestId, payload: 'tok_abc' }),
      );

      await expect(promise).resolves.toBe('tok_abc');
    });
  });

  describe('script loading', () => {
    beforeEach(() => {
      bridge.handleMessage(JSON.stringify({ type: 'shell_ready' }));
    });

    it('sets token domains before creating the script in bridge mode', async () => {
      const url = "https://cdn.example.com/challenge'script.js";
      await bridge.loadScript(
        url,
        ['api.example.com', 'api.example.net'],
      );

      expect(injectedCalls).toHaveLength(1);
      const injected = injectedCalls[0];
      expect(injected).toContain(
        'window.awsWafCookieDomainList = ["api.example.com","api.example.net"]',
      );
      expect(injected.indexOf('window.awsWafCookieDomainList')).toBeLessThan(
        injected.indexOf("document.createElement('script')"),
      );
      expect(injected).toContain(`s.src = ${JSON.stringify(url)}`);
    });

    it('sets token domains before calling the HTML loader', async () => {
      await bridge.loadScriptViaHtml(
        'https://cdn.example.com/challenge.js',
        ['api.example.com'],
      );

      expect(injectedCalls).toHaveLength(1);
      const injected = injectedCalls[0];
      expect(injected).toContain(
        'window.awsWafCookieDomainList = ["api.example.com"]',
      );
      expect(injected.indexOf('window.awsWafCookieDomainList')).toBeLessThan(
        injected.indexOf('window.__wafLoadScript'),
      );
    });
  });

  describe('hasToken', () => {
    it('resolves with boolean', async () => {
      const promise = bridge.hasToken(1000);
      await flush();

      const cmd = extractCommand(injectedCalls[0]);
      expect(cmd.type).toBe('hasToken');

      bridge.handleMessage(
        JSON.stringify({ type: 'resolve', requestId: cmd.requestId, payload: true }),
      );

      await expect(promise).resolves.toBe(true);
    });
  });

  describe('fetch', () => {
    it('resolves with response object shape', async () => {
      const body = "apostrophe: ', slash: \\";
      const promise = bridge.fetch(
        'https://example.com',
        { method: 'POST', body },
        1000,
      );
      await flush();

      const cmd = extractCommand(injectedCalls[0]);
      expect(cmd.type).toBe('fetch');
      expect(cmd.url).toBe('https://example.com');
      expect(cmd.options).toEqual({ method: 'POST', body });

      const response = { status: 200, headers: { 'content-type': 'application/json' }, body: '{}' };
      bridge.handleMessage(
        JSON.stringify({ type: 'resolve', requestId: cmd.requestId, payload: response }),
      );

      const result = await promise;
      expect(result.status).toBe(200);
      expect(result.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.body).toBe('{}');
    });
  });

  describe('timeout', () => {
    it('rejects on timeout', async () => {
      jest.useFakeTimers();

      const promise = bridge.getToken(50);

      // Flush the awaited readyPromise so send() proceeds to setTimeout
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(51);

      await expect(promise).rejects.toThrow(/timeout/i);

      jest.useRealTimers();
    });
  });

  describe('reject event', () => {
    it('rejects with error message on reject event', async () => {
      const promise = bridge.getToken(1000);
      await flush();

      const cmd = extractCommand(injectedCalls[0]);
      bridge.handleMessage(
        JSON.stringify({ type: 'reject', requestId: cmd.requestId, error: 'WAF failed' }),
      );

      await expect(promise).rejects.toThrow('WAF failed');
    });
  });

  describe('whenReady', () => {
    it('resolves on ready event', async () => {
      const freshBridge = new WafBridge();
      let resolved = false;
      freshBridge.whenReady().then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      freshBridge.handleMessage(JSON.stringify({ type: 'ready' }));

      await flush();
      expect(resolved).toBe(true);
    });
  });

  describe('dispose', () => {
    it('rejects all pending requests', async () => {
      const p1 = bridge.getToken(5000);
      const p2 = bridge.hasToken(5000);
      await flush();

      bridge.dispose();

      await expect(p1).rejects.toThrow(/disposed/i);
      await expect(p2).rejects.toThrow(/disposed/i);
    });
  });

  describe('malformed messages', () => {
    it('handles malformed messages gracefully', () => {
      expect(() => bridge.handleMessage('not json')).not.toThrow();
      expect(() => bridge.handleMessage('')).not.toThrow();
      expect(() => bridge.handleMessage('{}')).not.toThrow();
      expect(() => bridge.handleMessage('{"type":"unknown"}')).not.toThrow();
    });
  });

  describe('unique requestIds', () => {
    it('generates unique requestIds', async () => {
      const p1 = bridge.getToken(5000).catch(() => {});
      const p2 = bridge.hasToken(5000).catch(() => {});
      await flush();

      expect(injectedCalls).toHaveLength(2);
      const id1 = extractCommand(injectedCalls[0]).requestId;
      const id2 = extractCommand(injectedCalls[1]).requestId;
      expect(id1).not.toBe(id2);

      bridge.dispose();
      await p1;
      await p2;
    });
  });
});
