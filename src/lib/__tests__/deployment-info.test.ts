import { describe, expect, test } from 'vitest';
import { resolveDeploymentInfo } from '@/lib/deployment-info';

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

const SHA = '53157b9e79f93cea2d9cd922072e8a49d2ce393f';

describe('read-only release identity', () => {
  test('reports the committed package version', () => {
    expect(resolveDeploymentInfo(env({})).appVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('reports Vercel commit and deployment metadata when valid', () => {
    expect(
      resolveDeploymentInfo(
        env({
          VERCEL_ENV: 'production',
          VERCEL_GIT_COMMIT_SHA: SHA.toUpperCase(),
          VERCEL_DEPLOYMENT_ID: 'dpl_abc123-XYZ',
        }),
      ),
    ).toEqual({
      appVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
      commitSha: SHA,
      environment: 'production',
      deploymentId: 'dpl_abc123-XYZ',
    });
  });

  test('never invents a commit SHA or deployment id', () => {
    expect(
      resolveDeploymentInfo(
        env({
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_SHA: 'not-a-sha',
          VERCEL_DEPLOYMENT_ID: 'dpl_<script>',
        }),
      ),
    ).toMatchObject({
      commitSha: null,
      deploymentId: null,
      environment: 'preview',
    });
    expect(resolveDeploymentInfo(env({})).commitSha).toBeNull();
    expect(resolveDeploymentInfo(env({})).deploymentId).toBeNull();
  });

  test('distinguishes local production builds from hosted Production', () => {
    expect(resolveDeploymentInfo(env({ NODE_ENV: 'production' })).environment).toBe(
      'local-production',
    );
    expect(resolveDeploymentInfo(env({ NODE_ENV: 'development' })).environment).toBe(
      'local-development',
    );
    expect(resolveDeploymentInfo(env({ NODE_ENV: 'test' })).environment).toBe('test');
    expect(resolveDeploymentInfo(env({ NODE_ENV: 'staging' })).environment).toBeNull();
  });

  test('rejects an invalid package version instead of displaying it', () => {
    expect(resolveDeploymentInfo(env({}), '<script>').appVersion).toBeNull();
    expect(resolveDeploymentInfo(env({}), '').appVersion).toBeNull();
  });
});
