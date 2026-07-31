import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { WafBridge } from '../bridge';
import { WafProvider } from '../WafProvider';

const TOKEN_DOMAINS = ['api.example.com'] as const;

jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  const RealReact = require('react');
  const MockWebView = RealReact.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) =>
      RealReact.createElement(View, { ...props, ref, testID: 'mock-webview' }),
  );
  MockWebView.displayName = 'MockWebView';
  return { __esModule: true, default: MockWebView };
});

describe('WafProvider', () => {
  it('fails fast when token domains are missing', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const props = {
      challengeJsUrl: 'https://cdn.example.com/challenge.js',
      tokenDomains: [],
      children: <Text>Child</Text>,
    } as unknown as React.ComponentProps<typeof WafProvider>;

    expect(() => render(React.createElement(WafProvider, props))).toThrow(
      /tokenDomains/,
    );
    spy.mockRestore();
  });

  it('renders children', () => {
    const { getByText } = render(
      <WafProvider
        challengeJsUrl="https://cdn.example.com/challenge.js"
        tokenDomains={TOKEN_DOMAINS}
      >
        <Text>Hello</Text>
      </WafProvider>,
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders a WebView component', () => {
    const { getByTestId } = render(
      <WafProvider
        challengeJsUrl="https://cdn.example.com/challenge.js"
        tokenDomains={TOKEN_DOMAINS}
      >
        <Text>Child</Text>
      </WafProvider>,
    );
    expect(getByTestId('mock-webview')).toBeTruthy();
  });

  it('WebView is hidden (check style props)', () => {
    const { getByTestId } = render(
      <WafProvider
        challengeJsUrl="https://cdn.example.com/challenge.js"
        tokenDomains={TOKEN_DOMAINS}
      >
        <Text>Child</Text>
      </WafProvider>,
    );
    const webview = getByTestId('mock-webview');
    const style = webview.props.style;
    expect(style).toMatchObject({
      height: 0,
      width: 0,
      opacity: 0,
    });
    expect(webview.props.containerStyle).toMatchObject(style);
  });

  it('only disposes the bridge on unmount', () => {
    const disposeSpy = jest.spyOn(WafBridge.prototype, 'dispose');
    const { rerender, unmount } = render(
      <WafProvider
        challengeJsUrl="https://cdn.example.com/challenge.js"
        tokenDomains={TOKEN_DOMAINS}
        onError={jest.fn()}
      >
        <Text>Child</Text>
      </WafProvider>,
    );

    rerender(
      <WafProvider
        challengeJsUrl="https://cdn.example.com/challenge.js"
        tokenDomains={TOKEN_DOMAINS}
        onError={jest.fn()}
      >
        <Text>Child</Text>
      </WafProvider>,
    );

    expect(disposeSpy).not.toHaveBeenCalled();
    unmount();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    disposeSpy.mockRestore();
  });
});
