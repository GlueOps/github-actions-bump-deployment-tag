import { parseDocument } from "yaml";

/**
 * Machine-readable metadata embedded in every deploy PR body so the cleanup
 * action can group PRs by (app, env) WITHOUT reverse-parsing branch names.
 * The format below is a shared contract with github-actions-cleanup-deployment-prs.
 */
export interface DeployMeta {
  app: string;
  env: string;
  tag: string;
}

const MARKER_RE = /<!--\s*glueops-deploy:(\{.*?\})\s*-->/;

export function formatMarker(meta: DeployMeta): string {
  return `<!-- glueops-deploy:${JSON.stringify(meta)} -->`;
}

export function parseMarker(body: string | null | undefined): DeployMeta | null {
  if (!body) return null;
  const m = body.match(MARKER_RE);
  if (!m) return null;
  try {
    const o = JSON.parse(m[1]) as Record<string, unknown>;
    if (
      typeof o.app === "string" &&
      typeof o.env === "string" &&
      typeof o.tag === "string"
    ) {
      return { app: o.app, env: o.env, tag: o.tag };
    }
  } catch {
    /* malformed marker -> treat as absent */
  }
  return null;
}

/**
 * Sanitize a git ref into a valid, lowercase container image tag.
 * MUST stay byte-for-byte identical to GlueOps/github-actions-create-container-tags
 * so the config tag matches the image tag the build actually pushed.
 */
export function sanitizeTag(ref: string): string {
  return ref
    .replace(/\//g, "-") // slashes -> hyphens
    .replace(/[^a-zA-Z0-9_.-]/g, "_") // anything invalid -> underscore
    .replace(/ /g, "_") // spaces -> underscore
    .toLowerCase();
}

export interface RefInfo {
  eventName: string;
  ref: string;
  sha: string;
  releaseTag?: string;
}

/** Determine the image tag from the triggering event. */
export function computeTag(info: RefInfo): string {
  const isTag =
    info.eventName === "release" || info.ref.startsWith("refs/tags/");
  if (isTag) {
    let raw = info.releaseTag && info.releaseTag.length > 0 ? info.releaseTag : "";
    if (!raw && info.ref.startsWith("refs/tags/")) {
      raw = info.ref.slice("refs/tags/".length);
    }
    if (raw) return sanitizeTag(raw);
  }
  return info.sha.substring(0, 7);
}

/** Set image.tag in-place, preserving comments/formatting. */
export function setImageTag(yamlText: string, tag: string): string {
  const doc = parseDocument(yamlText);
  doc.setIn(["image", "tag"], tag);
  return doc.toString();
}
