// Model selection is server configuration, never client input. The default
// preserves the model this app shipped with; override with ANTHROPIC_MODEL.
// The format check rejects garbage/injection but leaves final validation to
// the Anthropic API (unknown IDs fail the request with a clear error).

export const DEFAULT_MODEL = 'claude-sonnet-4-6'

const MODEL_ID_RE = /^claude-[a-z0-9][a-z0-9.-]{1,48}$/

export function resolveModelId(configured?: string | null): string {
  if (typeof configured === 'string' && MODEL_ID_RE.test(configured.trim())) {
    return configured.trim()
  }
  if (configured) {
    console.warn(
      `ANTHROPIC_MODEL "${configured}" is not a valid Claude model id; using ${DEFAULT_MODEL}.`
    )
  }
  return DEFAULT_MODEL
}
