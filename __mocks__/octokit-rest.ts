// Stub for @octokit/rest. The constructor returns a client exposing just the
// getRepoInstallation call scopedOctokit uses. Tests assert on both spies.
export const __getRepoInstallation = jest.fn(async () => ({ data: { id: 999 } }));
export const Octokit = jest.fn(() => ({
  rest: { apps: { getRepoInstallation: __getRepoInstallation } },
}));
