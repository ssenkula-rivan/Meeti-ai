import { Pool, PoolConfig } from 'pg';
import { IDatabase } from './interfaces';

/**
 * pg's own PoolConfig plus one non-pg field. `statementTimeoutMs` is applied as
 * a per-connection `SET statement_timeout` (a server-side guardrail), not a pool
 * option, so we strip it before constructing the Pool.
 */
export interface DatabaseConfig extends PoolConfig {
  statementTimeoutMs?: number;
}

export class Database implements IDatabase {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    const { statementTimeoutMs, ...poolConfig } = config;

    this.pool = new Pool({
      // Bound the wait for a connection so an exhausted pool fails fast instead
      // of queueing requests against a saturated database.
      connectionTimeoutMillis: 10_000,
      // Survive intermediary / server idle timeouts between uses.
      keepAlive: true,
      ...poolConfig,
    });

    // CRITICAL: without a listener, a connection error raised while a client is
    // idle (server restart, network blip, idle reaper) is emitted on the pool as
    // an unhandled 'error' and crashes the entire Node process. Swallow it here;
    // the next acquire transparently gets a fresh, healthy client.
    this.pool.on('error', (err) => {
      console.error('[db] idle pool client error (recovered):', err?.message || err);
    });

    // Apply the per-statement ceiling to every new physical connection so a
    // runaway query cannot pin a client indefinitely. The value is a config-derived
    // integer (parseInt at boot) and Math.trunc keeps it numeric, so it is safe to
    // inline — Postgres does not allow bind parameters in SET statements.
    if (statementTimeoutMs && statementTimeoutMs > 0) {
      const ms = Math.trunc(statementTimeoutMs);
      this.pool.on('connect', (client) => {
        client.query(`SET statement_timeout = ${ms}`, (err) => {
          if (err) console.error('[db] failed to set statement_timeout:', err.message);
        });
      });
    }
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] || null;
  }

  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** Lightweight connectivity check for readiness probes. */
  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  /** Current pool occupancy — surfaced on /ready and available for metrics. */
  poolStats(): { total: number; idle: number; waiting: number } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export * from './interfaces';
export * from './repositories';
export * from './types';

