import type * as coreNS from "@actions/core";
import { computeTag, setImageTag, formatMarker } from "./lib";

interface FileData {
  type: string;
  sha: string;
  content: string;
}

/** Narrow structural view of the Octokit surface run() uses. Keeps the injected
 * fake trivial and avoids leaning on Octokit's full types. */
export interface BumpOctokit {
  rest: {
    repos: {
      getContent(p: { owner: string; repo: string; path: string; ref: string }): Promise<{
        data: FileData | unknown[];
      }>;
      createOrUpdateFileContents(p: {
        owner: string;
        repo: string;
        path: string;
        message: string;
        content: string;
        sha: string;
        branch: string;
      }): Promise<unknown>;
    };
    git: {
      getRef(p: { owner: string; repo: string; ref: string }): Promise<{
        data: { object: { sha: string } };
      }>;
      createRef(p: { owner: string; repo: string; ref: string; sha: string }): Promise<unknown>;
    };
    pulls: {
      create(p: {
        owner: string;
        repo: string;
        base: string;
        head: string;
        title: string;
        body: string;
      }): Promise<{ data: { number: number; html_url: string } }>;
      list(p: { owner: string; repo: string; state: "open"; head: string }): Promise<{
        data: Array<{ number: number; html_url: string; body?: string | null }>;
      }>;
      update(p: {
        owner: string;
        repo: string;
        pull_number: number;
        body: string;
      }): Promise<unknown>;
    };
  };
}

export interface BumpDeps {
  core: Pick<
    typeof coreNS,
    "getInput" | "getBooleanInput" | "setOutput" | "setSecret" | "info"
  >;
  context: {
    repo: { owner: string; repo: string };
    eventName: string;
    ref: string;
    sha: string;
    actor: string;
    payload: { release?: { tag_name?: string } };
  };
  makeOctokit: (a: {
    appId: string;
    privateKey: string;
    owner: string;
    repo: string;
  }) => Promise<BumpOctokit>;
}

function httpStatus(e: unknown): number | undefined {
  if (e && typeof e === "object" && "status" in e) {
    const s = (e as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

/** Combined error text (message + validation `errors[].message`) for 422 disambiguation. */
function errorText(e: unknown): string {
  if (e && typeof e === "object") {
    const anyE = e as { message?: unknown; errors?: Array<{ message?: unknown }> };
    const parts: string[] = [];
    if (typeof anyE.message === "string") parts.push(anyE.message);
    if (Array.isArray(anyE.errors)) {
      for (const er of anyE.errors) {
        if (er && typeof er.message === "string") parts.push(er.message);
      }
    }
    return parts.join(" ");
  }
  return String(e);
}

interface RemoteFile {
  sha: string;
  content: string;
}

async function getFile(
  octokit: BumpOctokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<RemoteFile> {
  const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Path is not a file: ${path}`);
  }
  return {
    sha: data.sha,
    content: Buffer.from(data.content, "base64").toString("utf8"),
  };
}

/**
 * Set image.tag on `branch` with optimistic-concurrency retry: on a 409/422
 * (branch advanced between read and write) re-read the file and re-apply the edit
 * to the FRESH content so a concurrent bump is not clobbered.
 * Returns true if a commit was made, false if already up to date.
 */
export async function commitToBranch(
  octokit: BumpOctokit,
  args: {
    owner: string;
    repo: string;
    path: string;
    branch: string;
    tag: string;
    message: string;
  },
  attempts = 3,
): Promise<boolean> {
  const { owner, repo, path, branch, tag, message } = args;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const file = await getFile(octokit, owner, repo, path, branch);
    const updated = setImageTag(file.content, tag);
    if (updated === file.content) return false;
    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(updated, "utf8").toString("base64"),
        sha: file.sha,
        branch,
      });
      return true;
    } catch (e) {
      const s = httpStatus(e);
      if ((s === 409 || s === 422) && attempt < attempts) {
        continue; // refetch fresh content + sha on the next iteration
      }
      throw e;
    }
  }
  return false;
}

export async function run(deps: BumpDeps): Promise<void> {
  const { core, context } = deps;

  const env = core.getInput("ENV", { required: true });
  const createPr = core.getBooleanInput("CREATE_PR");
  const appNameOverride = core.getInput("DEPLOYMENT_CONFIGS_APP_NAME");
  const configRepo =
    core.getInput("DEPLOYMENT_CONFIGS_REPO") || "deployment-configurations";
  const defaultBranch =
    core.getInput("DEPLOYMENT_CONFIGS_REPO_DEFAULT_BRANCH") || "main";
  const appId = core.getInput("app-id", { required: true });
  const privateKey = core.getInput("private-key", { required: true });
  core.setSecret(privateKey);

  const owner = context.repo.owner;
  const sourceRepo = context.repo.repo;
  const appName = appNameOverride || sourceRepo;
  const tag = computeTag({
    eventName: context.eventName,
    ref: context.ref,
    sha: context.sha,
    releaseTag: context.payload.release?.tag_name,
  });
  const path = `apps/${appName}/envs/${env}/values.yaml`;
  const message = `${sourceRepo}: updating ${env} tag to ${tag}, by ${context.actor}`;

  core.setOutput("tag", tag);
  core.info(`Target ${owner}/${configRepo} ${path} -> image.tag=${tag}`);

  const octokit = await deps.makeOctokit({ appId, privateKey, owner, repo: configRepo });

  // --- Direct commit to default branch ---
  if (!createPr) {
    const changed = await commitToBranch(octokit, {
      owner,
      repo: configRepo,
      path,
      branch: defaultBranch,
      tag,
      message,
    });
    core.setOutput("action", changed ? "committed" : "noop");
    core.info(changed ? `Committed to ${defaultBranch}.` : "Already up to date.");
    return;
  }

  // --- PR path ---
  const base = await getFile(octokit, owner, configRepo, path, defaultBranch);
  if (setImageTag(base.content, tag) === base.content) {
    core.info("Already up to date on the default branch; no PR needed.");
    core.setOutput("action", "noop");
    return;
  }

  const appPart = appNameOverride ? `${appNameOverride}-` : "";
  const branch = `${sourceRepo}/update-${appPart}${env}-image-tag-${tag}`;

  const baseRef = await octokit.rest.git.getRef({
    owner,
    repo: configRepo,
    ref: `heads/${defaultBranch}`,
  });
  try {
    await octokit.rest.git.createRef({
      owner,
      repo: configRepo,
      ref: `refs/heads/${branch}`,
      sha: baseRef.data.object.sha,
    });
  } catch (e) {
    if (httpStatus(e) !== 422) throw e; // 422 = branch already exists
    core.info(`Branch ${branch} already exists; reusing.`);
  }

  await commitToBranch(octokit, {
    owner,
    repo: configRepo,
    path,
    branch,
    tag,
    message,
  });

  const marker = formatMarker({ app: appName, env, tag });
  const body = `PR created via CD workflow in ${owner}/${sourceRepo} by ${context.actor}.\n\n${marker}`;

  try {
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo: configRepo,
      base: defaultBranch,
      head: branch,
      title: `${sourceRepo} [${env}] > ${tag}`,
      body,
    });
    core.setOutput("action", "created-pr");
    core.setOutput("pr-number", String(pr.number));
    core.setOutput("pr-url", pr.html_url);
    core.info(`Opened PR #${pr.number}: ${pr.html_url}`);
  } catch (e) {
    if (httpStatus(e) !== 422) throw e;
    // A 422 from pulls.create is ambiguous — disambiguate rather than assume:
    const existing = await octokit.rest.pulls.list({
      owner,
      repo: configRepo,
      state: "open",
      head: `${owner}:${branch}`,
    });
    if (existing.data.length > 0) {
      // Case A: a PR already exists for this head → reuse it, backfill the marker.
      const pr = existing.data[0];
      if (!/glueops-deploy:/.test(pr.body ?? "")) {
        await octokit.rest.pulls.update({
          owner,
          repo: configRepo,
          pull_number: pr.number,
          body: `${pr.body ?? ""}\n\n${marker}`,
        });
      }
      core.setOutput("action", "updated-pr");
      core.setOutput("pr-number", String(pr.number));
      core.setOutput("pr-url", pr.html_url);
      core.info(`Reused existing PR #${pr.number}: ${pr.html_url}`);
    } else if (/no commits between/i.test(errorText(e))) {
      // Case B: "No commits between base and head" — the branch matches base, so
      // there is genuinely nothing to PR. This is a no-op, NOT an updated PR.
      core.setOutput("action", "noop");
      core.info("No PR needed — the branch has no changes relative to the base.");
    } else {
      // Case C: an unexpected 422 — surface it instead of masking it as a PR update.
      throw e;
    }
  }
}
