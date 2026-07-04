/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  // @actions/core@3 and @octokit/* ship ESM-only exports maps (no `require`
  // condition) and pull in fetch/undici — unloadable under the CommonJS ts-jest
  // transform. octokit.ts is the only src file that imports them at runtime, so
  // redirect just those three specifiers to hand-written stubs. Everything else
  // (including ts-jest's own ESM deps) resolves normally.
  moduleNameMapper: {
    "^@actions/core$": "<rootDir>/__mocks__/actions-core.ts",
    "^@octokit/rest$": "<rootDir>/__mocks__/octokit-rest.ts",
    "^@octokit/auth-app$": "<rootDir>/__mocks__/octokit-auth-app.ts",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageThreshold: {
    global: { lines: 85, branches: 80, functions: 90 },
    "./src/lib.ts": { lines: 100, branches: 100, functions: 100 },
  },
};
