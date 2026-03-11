/**
 * Enforces commit message format: [ORGINIT-XXX][type] subject
 * ORGINIT prefix is mandatory. Example: [ORGINIT-123][feat] Add new endpoint
 */
module.exports = {
  parserPreset: {
    parserOpts: {
      headerPattern: /^\[(ORGINIT-\d+)\]\[(chore|fix|feat|docs|style|refactor|test|ci|build|perf)\]\s+(.+)$/,
      headerCorrespondence: ['ticket', 'type', 'subject'],
    },
  },
  rules: {
    'type-enum': [
      2,
      'always',
      ['chore', 'fix', 'feat', 'docs', 'style', 'refactor', 'test', 'ci', 'build', 'perf'],
    ],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
  },
  helpUrl:
    'Commit message must match: [ORGINIT-XXX][type] subject (e.g. [ORGINIT-123][feat] Add feature). Ticket ID must start with ORGINIT-. Types: chore, fix, feat, docs, style, refactor, test, ci, build, perf.',
};
