#!/usr/bin/env tsx
/**
 * W6-R05 operator CLI: export, validate or import approved published content.
 *
 * Connection URLs come only from environment variables (never argv/history):
 *   CONTENT_TRANSFER_SOURCE_URL  direct read-only source connection
 *   CONTENT_TRANSFER_TARGET_URL  direct migration/import connection
 *
 * Examples (identity strings never include credentials):
 *   pnpm content:transfer export --file /secure/content.json \
 *     --source-identity <host:port/db> --page home --include-faq
 *   pnpm content:transfer validate --file /secure/content.json \
 *     --expected-digest <sha256>
 *   pnpm content:transfer import --file /secure/content.json \
 *     --target-identity <host:port/db> --expected-digest <sha256> --dry-run
 */

import { parseArgs } from 'node:util';
import {
  CONTENT_TRANSFER_SOURCE_ENV,
  CONTENT_TRANSFER_TARGET_ENV,
  ContentTransferError,
  exportPublishedContent,
  importPublishedContent,
  loadContentTransferFile,
} from './content-transfer-lib';

function usage(): string {
  return [
    'Usage:',
    '  content-transfer export --file <path> --source-identity <id> --page <cms-page> [--page ...] [--include-faq]',
    '  content-transfer validate --file <path> [--expected-digest <sha256>]',
    '  content-transfer import --file <path> --target-identity <id> --expected-digest <sha256> [--dry-run]',
    '',
    `Environment: ${CONTENT_TRANSFER_SOURCE_ENV} (export), ${CONTENT_TRANSFER_TARGET_ENV} (import).`,
    'Never pass database URLs on the command line; use a silent prompt/secret store.',
  ].join('\n');
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ContentTransferError(`الوسيط ${name} مطلوب.`);
  }
  return value.trim();
}

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        file: { type: 'string' },
        page: { type: 'string', multiple: true },
        'include-faq': { type: 'boolean' },
        'source-identity': { type: 'string' },
        'target-identity': { type: 'string' },
        'expected-digest': { type: 'string' },
        'dry-run': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch {
    console.error(usage());
    return 1;
  }
  const command = parsed.positionals[0];
  if (parsed.values.help || !command) {
    console.log(usage());
    return command ? 0 : 1;
  }

  try {
    if (command === 'validate') {
      const file = requireString(parsed.values.file, '--file');
      const expectedDigest =
        typeof parsed.values['expected-digest'] === 'string'
          ? parsed.values['expected-digest'].trim()
          : undefined;
      const content = loadContentTransferFile(file, { expectedDigest });
      console.log(
        JSON.stringify(
          {
            ok: true,
            pages: content.pages,
            sectionCount: content.section_count,
            faqCount: content.faq_count,
            digest: content.digest,
          },
          null,
          2,
        ),
      );
      return 0;
    }

    if (command === 'export') {
      const file = requireString(parsed.values.file, '--file');
      const sourceIdentity = requireString(
        parsed.values['source-identity'],
        '--source-identity',
      );
      const pages = (parsed.values.page ?? []).map(String);
      const result = await exportPublishedContent({
        sourceUrl: process.env[CONTENT_TRANSFER_SOURCE_ENV],
        expectedSourceIdentity: sourceIdentity,
        pages,
        includeFaq: parsed.values['include-faq'] === true,
        filePath: file,
      });
      console.log(JSON.stringify({ ok: true, ...result.summary }, null, 2));
      return 0;
    }

    if (command === 'import') {
      const file = requireString(parsed.values.file, '--file');
      const targetIdentity = requireString(
        parsed.values['target-identity'],
        '--target-identity',
      );
      const expectedDigest = requireString(
        parsed.values['expected-digest'],
        '--expected-digest',
      );
      const summary = await importPublishedContent({
        targetUrl: process.env[CONTENT_TRANSFER_TARGET_ENV],
        expectedTargetIdentity: targetIdentity,
        filePath: file,
        expectedDigest,
        dryRun: parsed.values['dry-run'] === true,
      });
      console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
      return 0;
    }

    console.error(usage());
    return 1;
  } catch (error) {
    if (error instanceof ContentTransferError) {
      console.error(`Content transfer refused: ${error.message}`);
    } else {
      console.error('Content transfer failed. Check the local operator configuration.');
    }
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch(() => {
    console.error('Content transfer failed.');
    process.exit(1);
  });
