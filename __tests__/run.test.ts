import { run, commitToBranch, BumpDeps, BumpOctokit } from "../src/run";

const httpError = (
  status: number,
  message = "err",
  errors?: Array<{ message: string }>,
) => Object.assign(new Error(message), { status, message, errors });

const contentResponse = (yaml: string, sha = "sha1") => ({
  data: {
    type: "file",
    sha,
    encoding: "base64",
    content: Buffer.from(yaml, "utf8").toString("base64"),
  },
});

function makeOctokit() {
  return {
    rest: {
      repos: {
        getContent: jest.fn(),
        createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
      },
      git: {
        getRef: jest.fn().mockResolvedValue({ data: { object: { sha: "basesha" } } }),
        createRef: jest.fn().mockResolvedValue({}),
      },
      pulls: {
        create: jest.fn(),
        list: jest.fn().mockResolvedValue({ data: [] }),
        update: jest.fn().mockResolvedValue({}),
      },
    },
  };
}
type FakeOctokit = ReturnType<typeof makeOctokit>;

function makeCore(inputs: Record<string, string>) {
  return {
    getInput: (n: string, o?: { required?: boolean }) => {
      const v = inputs[n] ?? "";
      if (o?.required && !v) throw new Error(`missing ${n}`);
      return v;
    },
    getBooleanInput: (n: string) => inputs[n] === "true",
    setOutput: jest.fn(),
    setSecret: jest.fn(),
    info: jest.fn(),
  };
}

function makeDeps(
  inputs: Record<string, string>,
  octokit: FakeOctokit,
  ctx: Partial<BumpDeps["context"]> = {},
) {
  const core = makeCore(inputs);
  const makeOctokitFn = jest.fn(async () => octokit as unknown as BumpOctokit);
  const deps: BumpDeps = {
    core: core as unknown as BumpDeps["core"],
    context: {
      repo: { owner: "acme", repo: "api" },
      eventName: "release",
      ref: "refs/tags/v1.2.3",
      sha: "abcdef1234567",
      actor: "dev",
      payload: { release: { tag_name: "v1.2.3" } },
      ...ctx,
    },
    makeOctokit: makeOctokitFn,
  };
  return { deps, core, makeOctokitFn };
}

const base = { ENV: "prod", "app-id": "123", "private-key": "PK" };

describe("commitToBranch (optimistic-concurrency retry)", () => {
  const args = { owner: "o", repo: "r", path: "p", branch: "b", tag: "v1.2.3", message: "m" };

  it("writes once on the happy path and returns true", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    const r = await commitToBranch(o as unknown as BumpOctokit, args);
    expect(r).toBe(true);
    expect(o.rest.repos.createOrUpdateFileContents).toHaveBeenCalledTimes(1);
  });

  it("returns false without writing when already up to date", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: v1.2.3\n"));
    const r = await commitToBranch(o as unknown as BumpOctokit, args);
    expect(r).toBe(false);
    expect(o.rest.repos.createOrUpdateFileContents).not.toHaveBeenCalled();
  });

  it("on 409 re-reads FRESH content+sha and retries (no clobber)", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent
      .mockResolvedValueOnce(contentResponse("image:\n  tag: old\n", "sha1"))
      .mockResolvedValueOnce(contentResponse("image:\n  tag: other\n", "sha2"));
    o.rest.repos.createOrUpdateFileContents
      .mockRejectedValueOnce(httpError(409))
      .mockResolvedValueOnce({});
    const r = await commitToBranch(o as unknown as BumpOctokit, args);
    expect(r).toBe(true);
    expect(o.rest.repos.getContent).toHaveBeenCalledTimes(2);
    // the second write used the SHA from the re-read, not the stale one
    expect(o.rest.repos.createOrUpdateFileContents).toHaveBeenLastCalledWith(
      expect.objectContaining({ sha: "sha2" }),
    );
  });

  it("rethrows immediately on a non-retryable status (500)", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.repos.createOrUpdateFileContents.mockRejectedValue(httpError(500));
    await expect(commitToBranch(o as unknown as BumpOctokit, args)).rejects.toThrow();
    expect(o.rest.repos.getContent).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries on persistent 409", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.repos.createOrUpdateFileContents.mockRejectedValue(httpError(409));
    await expect(commitToBranch(o as unknown as BumpOctokit, args, 3)).rejects.toThrow();
    expect(o.rest.repos.getContent).toHaveBeenCalledTimes(3);
  });
});

describe("bump run()", () => {
  it("direct-commit path writes to the default branch and masks the private key", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    const { deps, core, makeOctokitFn } = makeDeps({ ...base, CREATE_PR: "false" }, o);
    await run(deps);
    expect(core.setSecret).toHaveBeenCalledWith("PK");
    expect(makeOctokitFn).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "deployment-configurations" }),
    );
    expect(o.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ branch: "main", path: "apps/api/envs/prod/values.yaml" }),
    );
    expect(core.setOutput).toHaveBeenCalledWith("action", "committed");
    expect(core.setOutput).toHaveBeenCalledWith("tag", "v1.2.3");
  });

  it("direct-commit noop: no write when already up to date", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: v1.2.3\n"));
    const { deps, core } = makeDeps({ ...base, CREATE_PR: "false" }, o);
    await run(deps);
    expect(o.rest.repos.createOrUpdateFileContents).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("action", "noop");
  });

  it("PR path: creates a branch + PR with a valid marker and sets outputs", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.pulls.create.mockResolvedValue({ data: { number: 42, html_url: "https://x/42" } });
    const { deps, core } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await run(deps);
    expect(o.rest.git.createRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "refs/heads/api/update-prod-image-tag-v1.2.3" }),
    );
    expect(o.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        base: "main",
        head: "api/update-prod-image-tag-v1.2.3",
        // Conventional-commit title (org linter requires it; must equal the commit
        // subject so squash-merges stay valid).
        title: "chore(deploy): api [prod] -> v1.2.3",
        body: expect.stringContaining('glueops-deploy:{"app":"api","env":"prod","tag":"v1.2.3"}'),
      }),
    );
    // The branch commit message is also conventional (subject == PR title) + carries
    // the human trigger as a git trailer since the bot authors the commit.
    expect(o.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "chore(deploy): api [prod] -> v1.2.3\n\nTriggered-by: @dev",
      }),
    );
    expect(core.setOutput).toHaveBeenCalledWith("action", "created-pr");
    expect(core.setOutput).toHaveBeenCalledWith("pr-number", "42");
    expect(core.setOutput).toHaveBeenCalledWith("pr-url", "https://x/42");
  });

  // Monorepo: the app-name override must drive the title + commit subject (not the
  // shared source repo), so two apps from one repo get distinct, disambiguated PRs.
  it("PR path: an app-name override disambiguates the title + commit subject", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.pulls.create.mockResolvedValue({ data: { number: 7, html_url: "https://x/7" } });
    const { deps } = makeDeps(
      { ...base, CREATE_PR: "true", DEPLOYMENT_CONFIGS_APP_NAME: "billing" },
      o,
    );
    await run(deps);
    expect(o.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "chore(deploy): billing [prod] -> v1.2.3" }),
    );
    expect(o.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        // path uses the app folder, subject uses the app name — both "billing", not "api"
        path: "apps/billing/envs/prod/values.yaml",
        message: "chore(deploy): billing [prod] -> v1.2.3\n\nTriggered-by: @dev",
      }),
    );
  });

  it("PR path noop: base already at the target tag → no PR created", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: v1.2.3\n"));
    const { deps, core } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await run(deps);
    expect(o.rest.git.createRef).not.toHaveBeenCalled();
    expect(o.rest.pulls.create).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith("action", "noop");
  });

  it("PR path: createRef 422 (branch exists) is tolerated and the PR still opens", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.git.createRef.mockRejectedValue(httpError(422));
    o.rest.pulls.create.mockResolvedValue({ data: { number: 7, html_url: "https://x/7" } });
    const { deps, core } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await run(deps);
    expect(core.setOutput).toHaveBeenCalledWith("action", "created-pr");
  });

  it("PR path: 422 with an existing PR lacking a marker → backfills + updated-pr", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.pulls.create.mockRejectedValue(httpError(422, "already exists"));
    o.rest.pulls.list.mockResolvedValue({
      data: [{ number: 9, html_url: "https://x/9", body: "old body no marker" }],
    });
    const { deps, core } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await run(deps);
    expect(o.rest.pulls.update).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith("action", "updated-pr");
    expect(core.setOutput).toHaveBeenCalledWith("pr-number", "9");
  });

  it("PR path: 422 with an existing PR that ALREADY has a marker → no backfill", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.pulls.create.mockRejectedValue(httpError(422, "already exists"));
    o.rest.pulls.list.mockResolvedValue({
      data: [{ number: 9, html_url: "https://x/9", body: 'has <!-- glueops-deploy:{"a":1} --> marker' }],
    });
    const { deps } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await run(deps);
    expect(o.rest.pulls.update).not.toHaveBeenCalled();
  });

  // THE BUG FIX: a 422 "No commits between base and head" must be a noop, NOT a
  // fake updated-pr pointing at a nonexistent PR.
  it('PR path: 422 "no commits between" with no existing PR → noop', async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.pulls.create.mockRejectedValue(
      httpError(422, "Validation Failed", [{ message: "No commits between main and api/x" }]),
    );
    o.rest.pulls.list.mockResolvedValue({ data: [] });
    const { deps, core } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await run(deps);
    expect(core.setOutput).toHaveBeenCalledWith("action", "noop");
    expect(core.setOutput).not.toHaveBeenCalledWith("action", "updated-pr");
  });

  // THE BUG FIX: an unexpected 422 must surface, not be masked as updated-pr.
  it("PR path: an unexpected 422 with no existing PR is rethrown", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    o.rest.pulls.create.mockRejectedValue(
      httpError(422, "Validation Failed", [{ message: "some other validation error" }]),
    );
    o.rest.pulls.list.mockResolvedValue({ data: [] });
    const { deps } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await expect(run(deps)).rejects.toThrow(/Validation Failed/);
  });

  it("errors when the config path resolves to a directory, not a file", async () => {
    const o = makeOctokit();
    // getContent returns an array for a directory listing → not a single file.
    o.rest.repos.getContent.mockResolvedValue({ data: [] });
    const { deps } = makeDeps({ ...base, CREATE_PR: "false" }, o);
    await expect(run(deps)).rejects.toThrow(/not a file/);
  });

  it("refuses a >1MB file (encoding:'none', empty content) instead of truncating it", async () => {
    const o = makeOctokit();
    // GitHub returns encoding:"none" + empty content for files over 1MB — decoding that
    // would overwrite the real file with a stub. run() must throw, not silently corrupt.
    o.rest.repos.getContent.mockResolvedValue({
      data: { type: "file", sha: "s", encoding: "none", content: "" },
    });
    const { deps } = makeDeps({ ...base, CREATE_PR: "false" }, o);
    await expect(run(deps)).rejects.toThrow(/unexpected content encoding/);
  });

  it("rethrows a non-HTTP error (no numeric status) from createRef", async () => {
    const o = makeOctokit();
    o.rest.repos.getContent.mockResolvedValue(contentResponse("image:\n  tag: old\n"));
    // a plain error without a `status` → httpStatus() is undefined → not a 422 → rethrow
    o.rest.git.createRef.mockRejectedValue(new Error("network down"));
    const { deps } = makeDeps({ ...base, CREATE_PR: "true" }, o);
    await expect(run(deps)).rejects.toThrow(/network down/);
  });
});
