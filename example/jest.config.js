module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react-native-webview$':
      '<rootDir>/test-utils/react-native-webview.mock.tsx',
  },
};
