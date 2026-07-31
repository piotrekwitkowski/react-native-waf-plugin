import { normalizeTokenDomains } from '../domains';

describe('normalizeTokenDomains', () => {
  it('normalizes leading dots, casing, and duplicates', () => {
    expect(
      normalizeTokenDomains([
        '.API.Example.com',
        'api.example.com',
        'auth.example.com',
      ]),
    ).toEqual(['api.example.com', 'auth.example.com']);
  });

  it('requires at least one domain', () => {
    expect(() => normalizeTokenDomains(undefined)).toThrow(/tokenDomains/);
    expect(() => normalizeTokenDomains([])).toThrow(/tokenDomains/);
  });

  it.each([
    'localhost',
    'https://api.example.com',
    'api.example.com:443',
    'api.example.com/path',
    '*.example.com',
  ])('rejects invalid domain %s', (domain) => {
    expect(() => normalizeTokenDomains([domain])).toThrow(
      /invalid token domain/,
    );
  });
});
