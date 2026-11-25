import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema> & { $client: Pool };
