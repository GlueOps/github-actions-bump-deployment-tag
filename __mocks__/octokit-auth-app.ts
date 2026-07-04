// Stub for @octokit/auth-app. createAppAuth() returns an auth() function that
// yields a fake installation token. Tests assert on both spies.
export const __authFn = jest.fn(async () => ({ token: "ghs_faketoken" }));
export const createAppAuth = jest.fn(() => __authFn);
