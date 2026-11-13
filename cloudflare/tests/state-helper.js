import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

// Real SQLite executes exactly the migration and SQL used by D1.
export function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_state.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_browser_push.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      const bind = (...values) => ({
        all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
        first: async () => sqlite.prepare(sql).get(...values) || null,
        run: async () => ({ meta: { changes: sqlite.prepare(sql).run(...values).changes } }),
      });
      return { ...bind(), bind };
    },
    state: () => JSON.parse(sqlite.prepare('SELECT payload FROM worker_state').get().payload),
    setState: state => sqlite.prepare('UPDATE worker_state SET payload = ?').run(JSON.stringify(state)),
    close: () => sqlite.close(),
  };
}
