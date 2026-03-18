export const FileEncoding = {
  Utf8: 'utf-8',
} as const;

export const LambdaArtifactFile = {
  Handler: 'handler.py',
  Init: '__init__.py',
} as const;

export const LambdaSharedLayout = {
  PythonSubdir: 'python',
} as const;

export const PathSegment = {
  Parent: '..',
  ConfigToRepoDepth: 2,
} as const;

export const RepoLayout = {
  SharedCodeDirName: 'shared',
} as const;

export const DotfilePrefix = '.' as const;
