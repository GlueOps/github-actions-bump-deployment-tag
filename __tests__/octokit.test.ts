// Assert least-privilege token scoping — the security crown jewel. The ESM-only
// @octokit/rest, @octokit/auth-app, and @actions/core are redirected to stubs via
// jest.config.js `moduleNameMapper`, so the real fetch-based packages never load
// under the CommonJS ts-jest transform. We import the stubs' spies to assert on.
import { scopedOctokit } from "../src/octokit";
import { setSecret } from "@actions/core";
import { __getRepoInstallation } from "../__mocks__/octokit-rest";
import { __authFn } from "../__mocks__/octokit-auth-app";

describe("scopedOctokit token scoping (security)", () => {
  it("mints a token scoped to ONLY the config repo with least-privilege permissions", async () => {
    await scopedOctokit("app-id", "pem", "acme", "deployment-configurations");

    expect(__getRepoInstallation).toHaveBeenCalledWith({
      owner: "acme",
      repo: "deployment-configurations",
    });
    expect(__authFn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "installation",
        installationId: 999,
        repositoryNames: ["deployment-configurations"],
        permissions: { contents: "write", pull_requests: "write" },
      }),
    );
    // the derived installation token must be masked in logs
    expect(setSecret).toHaveBeenCalledWith("ghs_faketoken");
  });
});
