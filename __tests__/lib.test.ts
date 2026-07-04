import {
  sanitizeTag,
  computeTag,
  setImageTag,
  formatMarker,
  parseMarker,
} from "../src/lib";

describe("sanitizeTag", () => {
  it("replaces slashes with hyphens", () => {
    expect(sanitizeTag("release/foo")).toBe("release-foo");
  });
  it("replaces invalid characters with underscores", () => {
    expect(sanitizeTag("feat/JIRA-123@x")).toBe("feat-jira-123_x");
  });
  it("lowercases", () => {
    expect(sanitizeTag("V2.0.0-RC1")).toBe("v2.0.0-rc1");
  });
  it("keeps valid tags unchanged", () => {
    expect(sanitizeTag("v1.2.3")).toBe("v1.2.3");
  });
});

// TAG-PARITY CONTRACT with GlueOps/github-actions-create-container-tags.
// sanitizeTag MUST produce byte-identical output to that action's bash sanitization
// (its action.yml: slashes->hyphens, [^a-zA-Z0-9_.-]->underscore, spaces->underscore,
// lowercase). If it drifts, the tag written to values.yaml won't match the image tag
// the build pushed, so the deploy points at an image that doesn't exist. These pairs
// were verified byte-for-byte against create-container-tags' sanitization on
// 2026-07-04. If this fails, sanitizeTag drifted from the contract — do NOT paper over
// it by regenerating the expected values; re-verify against create-container-tags.
describe("sanitizeTag parity contract (create-container-tags)", () => {
  const GOLDEN: Array<[string, string]> = [
    ["v1.2.3", "v1.2.3"],
    ["v1.0", "v1.0"],
    ["V2.0.0-RC1", "v2.0.0-rc1"],
    ["release/foo", "release-foo"],
    ["feature/JIRA-123", "feature-jira-123"],
    ["feat/JIRA-123@x", "feat-jira-123_x"],
    ["a/b/c/d", "a-b-c-d"],
    ["hello world", "hello_world"],
    ["weird#chars!here", "weird_chars_here"],
    ["UPPER_Case.Tag", "upper_case.tag"],
    ["-leading-hyphen", "-leading-hyphen"],
    [".leading.dot", ".leading.dot"],
    ["tag with  double  spaces", "tag_with__double__spaces"],
    ["mixed/Slash And@Sign", "mixed-slash_and_sign"],
    ["HEAD", "head"],
  ];
  it.each(GOLDEN)("sanitizeTag(%j) === %j (byte-identical to create-container-tags)", (input, expected) => {
    expect(sanitizeTag(input)).toBe(expected);
  });
});

describe("computeTag", () => {
  it("uses the release tag_name on release events", () => {
    expect(
      computeTag({ eventName: "release", ref: "refs/tags/v1.2.3", sha: "abcdef1234", releaseTag: "v1.2.3" }),
    ).toBe("v1.2.3");
  });
  it("strips refs/tags/ when no release tag_name", () => {
    expect(
      computeTag({ eventName: "push", ref: "refs/tags/v9.9.9", sha: "abcdef1234" }),
    ).toBe("v9.9.9");
  });
  it("falls back to a 7-char short sha for non-tag events", () => {
    expect(
      computeTag({ eventName: "push", ref: "refs/heads/main", sha: "0123456789abcdef" }),
    ).toBe("0123456");
  });
  it("does not leave refs/heads in the tag when a release lacks tag_name", () => {
    expect(
      computeTag({ eventName: "release", ref: "refs/heads/main", sha: "0123456789" }),
    ).toBe("0123456");
  });
});

describe("setImageTag", () => {
  it("updates image.tag and preserves comments", () => {
    const src = "image:\n  repository: foo # keep me\n  tag: old\n";
    const out = setImageTag(src, "new");
    expect(out).toContain("tag: new");
    expect(out).toContain("# keep me");
  });
  it("creates the image map if missing", () => {
    const out = setImageTag("other: 1\n", "v1");
    expect(out).toContain("image:");
    expect(out).toContain("tag: v1");
  });
  it("quotes numeric-looking tags so they stay strings", () => {
    const out = setImageTag("image:\n  tag: old\n", "1.0");
    // must NOT emit `tag: 1.0` (which would reparse as a float)
    expect(out).toMatch(/tag:\s*["']1\.0["']/);
  });
  it("is idempotent for an unchanged tag (round-trip stable)", () => {
    const src = "image:\n  tag: v1.2.3\n";
    expect(setImageTag(src, "v1.2.3")).toBe(src);
  });
});

describe("deploy marker round-trip", () => {
  it("formats and parses back", () => {
    const meta = { app: "api", env: "prod", tag: "v1.2.3-rc1" };
    expect(parseMarker(formatMarker(meta))).toEqual(meta);
  });
  it("survives surrounding PR body text", () => {
    const body = `Some PR text\n\n${formatMarker({ app: "ui", env: "stage", tag: "abc-1234" })}\n`;
    expect(parseMarker(body)).toEqual({ app: "ui", env: "stage", tag: "abc-1234" });
  });
  it("returns null for non-deploy bodies", () => {
    expect(parseMarker("just a normal PR")).toBeNull();
    expect(parseMarker(null)).toBeNull();
    expect(parseMarker("<!-- glueops-deploy:{bad json} -->")).toBeNull();
  });
});

// GOLDEN-FIXTURE CONTRACT: the marker string is a wire format shared, byte-for-byte,
// with the cleanup action (which parses what this action writes). This literal is
// copy-pasted into cleanup's lib.test.ts; if either side changes formatMarker's
// output, one of these two golden tests fails and pins the drift. DO NOT "fix" this
// by regenerating the literal from formatMarker — that would defeat the contract.
describe("deploy marker GOLDEN contract (shared with cleanup action)", () => {
  const GOLDEN = '<!-- glueops-deploy:{"app":"api","env":"prod","tag":"v1.2.3-rc1"} -->';
  const META = { app: "api", env: "prod", tag: "v1.2.3-rc1" };

  it("formatMarker emits the exact wire bytes", () => {
    expect(formatMarker(META)).toBe(GOLDEN);
  });
  it("parseMarker reads the exact wire bytes back", () => {
    expect(parseMarker(GOLDEN)).toEqual(META);
  });
});
