import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

// Real SQLite executes exactly the migration and SQL used by D1.
export function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_state.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_browser_push.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0003_v2_control_evidence_receipts.sql', import.meta.url), 'utf8'));
  const statement = (sql, values = []) => ({ sql, values });
  return {
    prepare(sql) {
      const bind = (...values) => ({
        all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
        first: async () => sqlite.prepare(sql).get(...values) || null,
        run: async () => ({ meta: { changes: sqlite.prepare(sql).run(...values).changes } }),
        _statement: statement(sql, values),
      });
      return { ...bind(), bind, _statement: statement(sql) };
    },
    batch: async statements => {
      const results = [];
      sqlite.exec('BEGIN');
      try {
        for (const item of statements) {
          const result = sqlite.prepare(item._statement.sql).run(...item._statement.values);
          results.push({ meta: { changes: result.changes } });
        }
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    state: () => JSON.parse(sqlite.prepare('SELECT payload FROM worker_state').get().payload),
    setState: state => sqlite.prepare('UPDATE worker_state SET payload = ?').run(JSON.stringify(state)),
    close: () => sqlite.close(),
  };
}
