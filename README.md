# react-native-aws-waf-plugin

React Native wrapper for AWS WAF challenge.js. Acquires WAF tokens via a hidden WebView bridge.

> AWS WAF also offers [native mobile SDKs](https://docs.aws.amazon.com/waf/latest/developerguide/waf-mobile-sdk.html) for Android and iOS, but they require contacting AWS for access and are distributed as private artifacts. This library takes a different approach — it uses the publicly available web SDK (`challenge.js`) on all platforms, running it inside a hidden WebView. You can find the challenge.js URL in your AWS WAF console (see [docs](https://docs.aws.amazon.com/waf/latest/developerguide/waf-application-integration.html)).

## Install

```bash
npm install @piwit/react-native-aws-waf-plugin
```

Peer dependency: `react-native-webview >= 13`.

### Android

No extra setup. `react-native-webview` auto-links on RN 0.60+. Just rebuild:

```bash
npx react-native run-android
```

### iOS

Install CocoaPods dependencies for `react-native-webview`, then rebuild:

```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

## Quick Start

```tsx
import { WafProvider, useWafToken } from '@piwit/react-native-aws-waf-plugin';

const CHALLENGE_JS = 'https://<your-id>.<region>.sdk.awswaf.com/<your-id>/<your-hash>/challenge.js';
// or edge: 'https://<your-id>.edge.sdk.awswaf.com/<your-id>/<your-hash>/challenge.js'
const TOKEN_DOMAINS = ['api.example.com'] as const;

function App() {
  return (
    <WafProvider
      challengeJsUrl={CHALLENGE_JS}
      tokenDomains={TOKEN_DOMAINS}
      onReady={() => console.log('WAF ready')}
    >
      <MyScreen />
    </WafProvider>
  );
}

function MyScreen() {
  const { token, loading, error, refresh } = useWafToken();

  if (loading) return <Text>Acquiring token...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;

  return <Text>Token: {token}</Text>;
}
```

## Token Domains

`tokenDomains` is required because the hidden WebView loads inline HTML and has no application hostname. The library sets `window.awsWafCookieDomainList` before loading `challenge.js`, allowing AWS WAF to store the first domain in the token.

Use the hostname of your WAF-protected API, not the `sdk.awswaf.com` challenge hostname, a URL, or `localhost`:

```tsx
<WafProvider
  challengeJsUrl={CHALLENGE_JS}
  tokenDomains={['api.example.com']}
>
  <App />
</WafProvider>
```

For APIs on related subdomains, prefer a shared parent domain:

```tsx
tokenDomains={['example.com']}
```

That domain must be accepted by each protected resource's web ACL token domain list. AWS WAF does not allow public suffixes such as `com` or `co.uk`.

For unrelated API domains, the first entry is the domain stored in the token. Additional domains are destinations where the token can be sent, and their web ACLs must accept the first domain:

```tsx
tokenDomains={['api.example.com', 'api.example.net']}
```

## Script Injection Modes

The library supports two ways to load `challenge.js` into the hidden WebView. Both avoid putting a `<script src="...">` tag directly in the HTML source.

### Mode 1: `bridge` (default)

Pure JS injection. The HTML is a bare shell containing only the message bridge handler. When the shell is ready, the RN bridge creates a `<script>` element via `injectJavaScript` and appends it to the document. All loading logic lives on the React Native side.

```tsx
<WafProvider challengeJsUrl="https://..." tokenDomains={['api.example.com']} />
// equivalent to:
<WafProvider
  challengeJsUrl="https://..."
  tokenDomains={['api.example.com']}
  scriptInjection="bridge"
/>
```

### Mode 2: `html`

HTML-based loader. The HTML template includes a `__wafLoadScript(url)` helper function. The RN bridge calls this function (via `injectJavaScript`) to kick off script loading. The loading logic lives in the HTML template rather than being constructed from the app layer.

```tsx
<WafProvider
  challengeJsUrl="https://..."
  tokenDomains={['api.example.com']}
  scriptInjection="html"
/>
```

### Comparison

| | `bridge` (default) | `html` |
|---|---|---|
| Script loader location | Injected from RN via `injectJavaScript` | Pre-defined in HTML template (`__wafLoadScript`) |
| HTML contains script logic | No | Yes |
| Runtime control | Full, app decides what/when to inject | Partial, app provides URL, HTML loads it |

Pick `bridge` when you want maximum control from the RN layer. Pick `html` if you prefer the loading mechanism to be self-contained in the WebView page.

## API Reference

### `<WafProvider>`

Wrap your app (or a subtree) with this component. It renders a hidden 0x0 WebView and provides the WAF client to descendant hooks.

| Prop | Type | Default | Description |
|---|---|---|---|
| `challengeJsUrl` | `string` | required | Full URL to the AWS WAF challenge.js script |
| `tokenDomains` | `readonly [string, ...string[]]` | required | WAF-protected API hostnames. The first domain is stored in the token |
| `scriptInjection` | `'bridge' \| 'html'` | `'bridge'` | How challenge.js is loaded into the WebView |
| `timeout` | `number` | `10000` | Timeout in ms for bridge operations |
| `onReady` | `() => void` | `undefined` | Called when challenge.js has loaded and is ready |
| `onError` | `(error: Error) => void` | `undefined` | Called on unrecoverable errors |

### `useWafToken()`

Returns a reactive token state. Automatically fetches a token once the bridge is ready.

```ts
const { token, loading, error, refresh } = useWafToken();
```

| Field | Type | Description |
|---|---|---|
| `token` | `string \| null` | Current token value, or `null` if not yet acquired |
| `loading` | `boolean` | Whether a token request is in flight |
| `error` | `Error \| null` | Last error from token acquisition |
| `refresh` | `() => Promise<string>` | Manually trigger a fresh token request |

### `useWafFetch()`

Returns a fetch-like function that auto-attaches the WAF token to requests.

```ts
const wafFetch = useWafFetch();

const response = await wafFetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
});

console.log(response.status, response.body);
```

Returns `Promise<WafFetchResponse>` with `{ status: number, headers: Record<string, string>, body: string }`.

### `useWafClient()`

Returns the underlying `WafClient` object for direct access. Must be called within a `<WafProvider>`.

```ts
const client = useWafClient();

if (client.isReady) {
  const token = await client.getToken();
  const hasOne = await client.hasToken();
  const resp = await client.fetch(url, options);
}
```

| Method / Property | Type | Description |
|---|---|---|
| `getToken()` | `Promise<string>` | Get a fresh WAF token |
| `hasToken()` | `Promise<boolean>` | Check if an unexpired token exists |
| `fetch(url, options?)` | `Promise<WafFetchResponse>` | Fetch with WAF token auto-attached |
| `isReady` | `boolean` | Whether challenge.js has loaded |

### `WafBridge` (advanced)

Low-level bridge class for use outside of React. You probably don't need this unless you're building a custom integration.

```ts
import { WafBridge } from '@piwit/react-native-aws-waf-plugin';

const bridge = new WafBridge(10_000);
bridge.setInjector((js) => webViewRef.current?.injectJavaScript(js));
bridge.setCallbacks(
  () => console.log('ready'),
  (err) => console.error(err),
);

await bridge.whenShellReady();
bridge.loadScript('https://...', ['api.example.com']);

await bridge.whenReady();
const token = await bridge.getToken();

bridge.dispose();
```

## How It Works

1. `WafProvider` renders a hidden 0x0 `WebView` off-screen.
2. The WebView loads a minimal HTML shell containing a message bridge (listens for `postMessage` commands).
3. The configured token domains are assigned to `window.awsWafCookieDomainList`, then `challenge.js` is injected using the chosen injection mode.
4. Once loaded, `AwsWafIntegration.getToken()` and friends become available inside the WebView.
5. RN hooks send commands via `injectJavaScript` → the bridge handler calls the WAF SDK → results come back via `window.ReactNativeWebView.postMessage`.
6. The token surfaces in your React components through `useWafToken()` or `useWafClient()`.

## License

MIT
