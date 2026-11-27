import packageJson from '../../package.json';

/**
 * Read-only release identity for the protected owner Settings page
 * (W6-B04, closes NKW-W5-004).
 *
 * Every value comes from trusted build/runtime metadata or the committed
 * package version. Missing or malformed values are reported as unavailable;
 * no commit SHA, deployment id or version is ever invented. This module
 * returns only non-sensitive fields and never reads secrets, database URLs,
 * tokens or private integration configuration.
 */

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;

export type DeploymentEnvironment =
  | 'production'
  | 'preview'
  | 'development'
  | 'local-production'
  | 'local-development'
  | 'test';

export type DeploymentInfo = {
  appVersion: string | null;
  commitSha: string | null;
  environment: DeploymentEnvironment | null;
  deploymentId: string | null;
};

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveEnvironment(env: NodeJS.ProcessEnv): DeploymentEnvironment | null {
  const vercelEnv = nonEmpty(env.VERCEL_ENV)?.toLowerCase();
  if (vercelEnv === 'production' || vercelEnv === 'preview' || vercelEnv === 'development') {
    return vercelEnv;
  }
  const nodeEnv = nonEmpty(env.NODE_ENV)?.toLowerCase();
  if (nodeEnv === 'production') return 'local-production';
  if (nodeEnv === 'development') return 'local-development';
  if (nodeEnv === 'test') return 'test';
  return null;
}

export function resolveDeploymentInfo(
  env: NodeJS.ProcessEnv = process.env,
  version: unknown = packageJson.version,
): DeploymentInfo {
  const appVersion =
    typeof version === 'string' && VERSION_PATTERN.test(version) ? version : null;

  const rawCommit = nonEmpty(env.VERCEL_GIT_COMMIT_SHA);
  const commitSha = rawCommit && COMMIT_SHA_PATTERN.test(rawCommit)
    ? rawCommit.toLowerCase()
    : null;

  const rawDeploymentId = nonEmpty(env.VERCEL_DEPLOYMENT_ID);
  const deploymentId =
    rawDeploymentId && DEPLOYMENT_ID_PATTERN.test(rawDeploymentId)
      ? rawDeploymentId
      : null;

  return {
    appVersion,
    commitSha,
    environment: resolveEnvironment(env),
    deploymentId,
  };
}
