// Runtime secret injected via `wrangler secret put GH_TOKEN` (not stored in wrangler.jsonc).
interface Env {
  readonly GH_TOKEN?: string;
}
