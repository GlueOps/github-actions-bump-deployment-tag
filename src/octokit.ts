import { setSecret } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

/**
 * Mint an installation token scoped to ONLY the config repo AND only the needed
 * permissions, then return an Octokit authed with it. This is the real-GitHub
 * token-minting seam; run.ts receives the finished client via a factory so its
 * logic can be tested without touching GitHub App auth.
 */
export async function scopedOctokit(
  appId: string,
  privateKey: string,
  owner: string,
  repo: string,
): Promise<Octokit> {
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });
  const { data: installation } = await appOctokit.rest.apps.getRepoInstallation({
    owner,
    repo,
  });
  const auth = createAppAuth({ appId, privateKey });
  const { token } = await auth({
    type: "installation",
    installationId: installation.id,
    repositoryNames: [repo],
    permissions: { contents: "write", pull_requests: "write" },
  });
  setSecret(token); // ensure the derived token is masked in logs
  return new Octokit({ auth: token });
}
