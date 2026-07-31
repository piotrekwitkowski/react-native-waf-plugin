import { normalizeTokenDomains } from './domains';
import type {
  BridgeEvent,
  WafFetchOptions,
  WafFetchResponse,
  WafTokenDomains,
} from './types';

type BridgeEventExtended = BridgeEvent | { type: 'shell_ready' };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT = 10_000;

export class WafBridge {
  private pending = new Map<string, PendingRequest>();
  private counter = 0;
  private injectJs: ((js: string) => void) | null = null;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;
  private shellReadyResolve: (() => void) | null = null;
  private shellReadyPromise: Promise<void>;
  private isReady = false;
  private defaultTimeout: number;
  private onReadyCb?: () => void;
  private onErrorCb?: (error: Error) => void;

  constructor(defaultTimeout?: number) {
    this.defaultTimeout = defaultTimeout ?? DEFAULT_TIMEOUT;
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });
    this.shellReadyPromise = new Promise<void>((resolve) => {
      this.shellReadyResolve = resolve;
    });
  }

  setCallbacks(onReady?: () => void, onError?: (error: Error) => void): void {
    this.onReadyCb = onReady;
    this.onErrorCb = onError;
  }

  setInjector(fn: (js: string) => void): void {
    this.injectJs = fn;
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  whenShellReady(): Promise<void> {
    return this.shellReadyPromise;
  }

  handleMessage(rawData: string): void {
    let event: BridgeEventExtended;
    try {
      event = JSON.parse(rawData) as BridgeEventExtended;
    } catch {
      return;
    }

    switch (event.type) {
      case 'shell_ready':
        this.shellReadyResolve?.();
        this.shellReadyResolve = null;
        break;

      case 'ready':
        this.isReady = true;
        this.readyResolve?.();
        this.readyResolve = null;
        this.onReadyCb?.();
        break;

      case 'error':
        this.onErrorCb?.(new Error(event.error));
        break;

      case 'resolve': {
        const pending = this.pending.get(event.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(event.requestId);
          pending.resolve(event.payload);
        }
        break;
      }

      case 'reject': {
        const pending = this.pending.get(event.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(event.requestId);
          pending.reject(new Error(event.error));
        }
        break;
      }
    }
  }

  async loadScript(url: string, tokenDomains: WafTokenDomains): Promise<void> {
    await this.shellReadyPromise;
    if (!this.injectJs) {
      throw new Error('WafBridge: injector not set. Is WafProvider mounted?');
    }
    const serializedUrl = JSON.stringify(url);
    const serializedError = JSON.stringify(`Failed to load script: ${url}`);
    const serializedTokenDomains = JSON.stringify(normalizeTokenDomains(tokenDomains));
    this.injectJs(`(function(){
      window.awsWafCookieDomainList = ${serializedTokenDomains};
      var s = document.createElement('script');
      s.src = ${serializedUrl};
      s.onload = function() { waitForWaf(25); };
      s.onerror = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          error: ${serializedError}
        }));
      };
      document.head.appendChild(s);
    })(); true;`);
  }

  async loadScriptViaHtml(url: string, tokenDomains: WafTokenDomains): Promise<void> {
    await this.shellReadyPromise;
    if (!this.injectJs) {
      throw new Error('WafBridge: injector not set. Is WafProvider mounted?');
    }
    const serializedUrl = JSON.stringify(url);
    const serializedTokenDomains = JSON.stringify(normalizeTokenDomains(tokenDomains));
    this.injectJs(`window.awsWafCookieDomainList = ${serializedTokenDomains};
      window.__wafLoadScript(${serializedUrl}); true;`);
  }

  private async send<T>(
    command: { type: string; [key: string]: unknown },
    timeout?: number,
  ): Promise<T> {
    await this.readyPromise;

    if (!this.injectJs) {
      throw new Error('WafBridge: injector not set. Is WafProvider mounted?');
    }

    const requestId = `r${++this.counter}`;
    const fullCommand = { ...command, requestId };
    const serializedCommand = JSON.stringify(JSON.stringify(fullCommand));

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`WafBridge: timeout after ${timeout ?? this.defaultTimeout}ms for ${command.type}`));
      }, timeout ?? this.defaultTimeout);

      this.pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      this.injectJs!(
        `window.dispatchEvent(new MessageEvent('message', { data: ${serializedCommand} })); true;`,
      );
    });
  }

  async getToken(timeout?: number): Promise<string> {
    return this.send<string>({ type: 'getToken' }, timeout);
  }

  async hasToken(timeout?: number): Promise<boolean> {
    return this.send<boolean>({ type: 'hasToken' }, timeout);
  }

  async fetch(
    url: string,
    options?: WafFetchOptions,
    timeout?: number,
  ): Promise<WafFetchResponse> {
    return this.send<WafFetchResponse>(
      { type: 'fetch', url, options },
      timeout,
    );
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('WafBridge: disposed'));
      this.pending.delete(id);
    }
  }
}
