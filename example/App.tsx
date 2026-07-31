import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  WafProvider,
  useWafToken,
  useWafFetch,
} from '@piwit/react-native-aws-waf-plugin';
import type { WafFetchResponse } from '@piwit/react-native-aws-waf-plugin';

const DEFAULT_CHALLENGE_URL =
  'https://<your-id>.<region>.sdk.awswaf.com/<your-id>/<your-hash>/challenge.js';

const TOKEN_DOMAINS = ['api.example.com'] as const;

const DEMO_FETCH_URL = 'https://httpbin.org/get';

function TokenDisplay() {
  const { token, loading, error, refresh } = useWafToken();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>WAF Token State</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Loading:</Text>
        <Text style={styles.value}>{loading ? 'Yes' : 'No'}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Token:</Text>
        <Text style={styles.value} numberOfLines={3}>
          {token ?? '(none)'}
        </Text>
      </View>

      {error && (
        <View style={styles.row}>
          <Text style={styles.label}>Error:</Text>
          <Text style={[styles.value, styles.errorText]}>{error.message}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          refresh().catch(() => {});
        }}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Refreshing…' : 'Refresh Token'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function FetchDemo() {
  const wafFetch = useWafFetch();
  const [result, setResult] = useState<WafFetchResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const handleFetch = async () => {
    setFetching(true);
    setFetchError(null);
    setResult(null);
    try {
      const response = await wafFetch(DEMO_FETCH_URL);
      setResult(response);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>WAF Fetch Demo</Text>
      <Text style={styles.hint}>GET {DEMO_FETCH_URL}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleFetch}
        disabled={fetching}
      >
        <Text style={styles.buttonText}>
          {fetching ? 'Fetching…' : 'Make WAF Fetch'}
        </Text>
      </TouchableOpacity>

      {fetchError && (
        <Text style={[styles.value, styles.errorText]}>{fetchError}</Text>
      )}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.label}>Status: {result.status}</Text>
          <Text style={styles.resultBody} numberOfLines={10}>
            {result.body}
          </Text>
        </View>
      )}
    </View>
  );
}

function App(): React.JSX.Element {
  const [challengeUrl, setChallengeUrl] = useState(DEFAULT_CHALLENGE_URL);
  const [ready, setReady] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>WAF Plugin Example</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration</Text>
          <Text style={styles.label}>Challenge.js URL:</Text>
          <TextInput
            style={styles.input}
            value={challengeUrl}
            onChangeText={setChallengeUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://..."
          />
          <Text style={styles.hint}>
            Provider ready: {ready ? 'Yes' : 'No'}
          </Text>
          {providerError && (
            <Text style={[styles.hint, styles.errorText]}>
              Provider error: {providerError}
            </Text>
          )}
        </View>

        <WafProvider
          challengeJsUrl={challengeUrl}
          tokenDomains={TOKEN_DOMAINS}
          onReady={() => setReady(true)}
          onError={(err) => setProviderError(err.message)}
        >
          <TokenDisplay />
          <FetchDemo />
        </WafProvider>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    color: '#555',
    marginRight: 8,
    fontSize: 14,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#222',
  },
  errorText: {
    color: '#d32f2f',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  resultBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  resultBody: {
    fontSize: 12,
    color: '#444',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});

export default App;
