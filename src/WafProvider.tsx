import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { WafBridge } from './bridge';
import { normalizeTokenDomains } from './domains';
import { generateHtml, generateHtmlWithLoader } from './html';
import type { WafClient, WafConfig } from './types';
import { WafContext } from './WafContext';

export interface WafProviderProps extends WafConfig {
  children: React.ReactNode;
}

const HIDDEN_STYLE = { height: 0, width: 0, position: 'absolute' as const, top: -1000, left: -1000, opacity: 0 };

export function WafProvider({
  challengeJsUrl,
  tokenDomains,
  timeout,
  scriptInjection = 'bridge',
  onReady,
  onError,
  children,
}: WafProviderProps) {
  const webViewRef = useRef<WebView>(null);
  const bridgeRef = useRef(new WafBridge(timeout));
  const [isReady, setIsReady] = useState(false);
  const normalizedTokenDomains = normalizeTokenDomains(tokenDomains);
  const tokenDomainsKey = normalizedTokenDomains.join(',');

  useEffect(() => {
    const bridge = bridgeRef.current;
    bridge.setCallbacks(
      () => {
        setIsReady(true);
        onReady?.();
      },
      (err) => onError?.(err),
    );
  }, [onReady, onError]);

  useEffect(() => {
    const bridge = bridgeRef.current;
    return () => bridge.dispose();
  }, []);

  useEffect(() => {
    const bridge = bridgeRef.current;
    bridge.setInjector((js: string) => {
      webViewRef.current?.injectJavaScript(js);
    });

    bridge.whenShellReady().then(() => {
      if (scriptInjection === 'bridge') {
        bridge.loadScript(challengeJsUrl, normalizedTokenDomains);
      } else {
        bridge.loadScriptViaHtml(challengeJsUrl, normalizedTokenDomains);
      }
    });
  }, [challengeJsUrl, scriptInjection, tokenDomainsKey]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    bridgeRef.current.handleMessage(event.nativeEvent.data);
  }, []);

  const client: WafClient = useMemo(
    () => ({
      getToken: () => bridgeRef.current.getToken(timeout),
      hasToken: () => bridgeRef.current.hasToken(timeout),
      fetch: (url, opts) => bridgeRef.current.fetch(url, opts, timeout),
      isReady,
    }),
    [isReady, timeout],
  );

  const html = useMemo(
    () => scriptInjection === 'bridge' ? generateHtml() : generateHtmlWithLoader(),
    [scriptInjection],
  );

  return React.createElement(
    WafContext.Provider,
    { value: client },
    React.createElement(WebView, {
      ref: webViewRef,
      source: { html },
      onMessage: handleMessage,
      originWhitelist: ['*'],
      javaScriptEnabled: true,
      style: HIDDEN_STYLE,
      containerStyle: HIDDEN_STYLE,
      pointerEvents: 'none',
    }),
    children,
  );
}
