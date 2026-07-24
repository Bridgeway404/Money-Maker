import coreWebVitals from 'eslint-config-next/core-web-vitals'

// Next.js 16 removed `next lint`; this is the ESLint CLI flat config using
// eslint-config-next's native flat export. The rule set is unchanged from
// the previous .eslintrc.json (`next/core-web-vitals`); the two known
// react-hooks/exhaustive-deps warnings remain warnings.
const eslintConfig = [
  ...coreWebVitals,
  {
    rules: {
      // New rule shipped by the react-hooks plugin major inside
      // eslint-config-next 16. ChatPanel's initial-message seeding is a
      // pre-existing, load-bearing pattern (the prop arrives after mount
      // when the report loads), so an automatic "fix" would change
      // behavior. Kept VISIBLE as a warning — like the two known
      // exhaustive-deps warnings — with the refactor tracked for the
      // follow-up UI pass, not silenced.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'archive/**',
      'deploy-placeholder/**',
      'next-env.d.ts',
    ],
  },
]

export default eslintConfig
