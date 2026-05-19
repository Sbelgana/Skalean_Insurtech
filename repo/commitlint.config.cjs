/**
 * Skalean InsurTech v2.2 -- commitlint config
 * Reference: B-01 Tache 1.1.14
 * Conventional Commits + custom rules
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // new feature
        'fix',      // bug fix
        'docs',     // documentation
        'style',    // formatting (no code change)
        'refactor', // code refactoring
        'perf',     // performance improvement
        'test',     // tests
        'build',    // build system
        'ci',       // CI/CD
        'chore',    // tooling
        'revert',   // revert previous commit
      ],
    ],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
    'header-max-length': [2, 'always', 120],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
  },
};
