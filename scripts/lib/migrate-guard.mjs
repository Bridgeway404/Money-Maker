// Pure decision logic for the migration/seed production guard.
// Kept free of process/env access so it is unit-testable.

export const OVERRIDE_VALUE = 'I_UNDERSTAND_THIS_IS_PRODUCTION'

const PRODUCTION_BRANCH_PATTERN = /^(main|master|production|prod)$/i

/**
 * Decide whether a database command may run.
 *
 * @param {object} env - relevant environment values (never the connection string)
 * @param {string|undefined} env.targetBranch  - NEON_TARGET_BRANCH
 * @param {string|undefined} env.isProduction  - NEON_TARGET_IS_PRODUCTION
 * @param {string|undefined} env.override      - ALLOW_PRODUCTION_MIGRATION
 * @param {boolean} env.hasDatabaseUrl         - whether DATABASE_URL_UNPOOLED is set
 * @returns {{ allowed: boolean, reason: string, production: boolean }}
 */
export function evaluateGuard({ targetBranch, isProduction, override, hasDatabaseUrl }) {
  if (!hasDatabaseUrl) {
    return {
      allowed: false,
      production: false,
      reason:
        'DATABASE_URL_UNPOOLED is not set. Provide the UNPOOLED connection string for the target Neon branch (never commit it, never print it).',
    }
  }

  if (!targetBranch || targetBranch.trim() === '') {
    return {
      allowed: false,
      production: false,
      reason:
        'NEON_TARGET_BRANCH is not set. Set it to the Neon branch name the connection string points at (e.g. "development") so the target is stated explicitly.',
    }
  }

  const branch = targetBranch.trim()
  const flaggedProduction =
    PRODUCTION_BRANCH_PATTERN.test(branch) ||
    String(isProduction).toLowerCase() === 'true'

  if (!flaggedProduction) {
    return {
      allowed: true,
      production: false,
      reason: `Target branch "${branch}" is not a production branch.`,
    }
  }

  if (override === OVERRIDE_VALUE) {
    return {
      allowed: true,
      production: true,
      reason: `Target branch "${branch}" IS PRODUCTION — explicit override provided.`,
    }
  }

  return {
    allowed: false,
    production: true,
    reason:
      `Target branch "${branch}" looks like PRODUCTION. Refusing. ` +
      `If (and only if) a production migration has been approved, re-run with ` +
      `ALLOW_PRODUCTION_MIGRATION=${OVERRIDE_VALUE}.`,
  }
}
