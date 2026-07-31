export type WafTokenDomains = readonly [string, ...string[]];

export interface WafConfig {
  /** Full URL to the challenge.js script */
  challengeJsUrl: string;
  /** Domains where the WAF token will be used. The first domain is stored in the token. */
  tokenDomains: WafTokenDomains;
  /** Timeout in ms for bridge operations (default: 10000) */
  timeout?: number;
  /** How challenge.js is injected into the WebView (default: 'bridge') */
  scriptInjection?: 'bridge' | 'html';
  /** Called when challenge.js is loaded and ready */
  onReady?: () => void;
  /** Called on unrecoverable errors */
  onError?: (error: Error) => void;
}

export interface WafClient {
  /** Get the current valid WAF token. Resolves with the token string. */
  getToken(): Promise<string>;
  /** Check if an unexpired token exists. */
  hasToken(): Promise<boolean>;
  /** WebView fetch wrapper that auto-attaches the WAF token. Browser CORS rules apply. */
  fetch(url: string, options?: WafFetchOptions): Promise<WafFetchResponse>;
  /** Whether challenge.js has loaded and is ready. */
  isReady: boolean;
}

export interface WafFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface WafFetchResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface WafTokenState {
  /** Current token value, or null if not yet acquired */
  token: string | null;
  /** Whether a token request is in flight */
  loading: boolean;
  /** Last error from token acquisition */
  error: Error | null;
  /** Request the current valid token and update the hook state */
  refresh: () => Promise<string>;
}

export type BridgeCommand =
  | { type: 'getToken'; requestId: string }
  | { type: 'hasToken'; requestId: string }
  | { type: 'fetch'; requestId: string; url: string; options?: WafFetchOptions };

export type BridgeEvent =
  | { type: 'ready' }
  | { type: 'error'; error: string }
  | { type: 'resolve'; requestId: string; payload: unknown }
  | { type: 'reject'; requestId: string; error: string };
