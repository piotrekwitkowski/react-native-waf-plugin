import type { WafTokenDomains } from './types';

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function normalizeTokenDomains(
  tokenDomains: readonly string[] | null | undefined,
): WafTokenDomains {
  if (!Array.isArray(tokenDomains) || tokenDomains.length === 0) {
    throw new Error(
      'WafProvider: tokenDomains must contain at least one WAF-protected API hostname, for example "api.example.com".',
    );
  }

  const normalized = tokenDomains.map((domain) => {
    const hostname = typeof domain === 'string'
      ? domain.trim().replace(/^\./, '').toLowerCase()
      : '';

    if (!HOSTNAME_PATTERN.test(hostname)) {
      throw new Error(
        `WafProvider: invalid token domain "${String(domain)}". Use a hostname without a protocol, port, path, or wildcard.`,
      );
    }

    return hostname;
  });

  return [...new Set(normalized)] as [string, ...string[]];
}
