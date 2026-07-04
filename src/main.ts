import * as core from "@actions/core";
import { context } from "@actions/github";
import { run, BumpOctokit } from "./run";
import { scopedOctokit } from "./octokit";

// Thin ncc entrypoint: assemble real dependencies and hand off to run().
async function main(): Promise<void> {
  await run({
    core,
    context: {
      repo: context.repo,
      eventName: context.eventName,
      ref: context.ref,
      sha: context.sha,
      actor: context.actor,
      payload: context.payload as { release?: { tag_name?: string } },
    },
    makeOctokit: async (a): Promise<BumpOctokit> => {
      const octokit = await scopedOctokit(a.appId, a.privateKey, a.owner, a.repo);
      return octokit as unknown as BumpOctokit;
    },
  });
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : String(e)));
