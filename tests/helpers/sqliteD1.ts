import { DatabaseSync, type SQLInputValue } from "node:sqlite";

class SqliteStatement {
  constructor(private db: DatabaseSync, private sql: string, private values: SQLInputValue[] = []) {}
  bind(...values: unknown[]) { return new SqliteStatement(this.db, this.sql, values as SQLInputValue[]); }
  first<T>(): T | null { return (this.db.prepare(this.sql).get(...this.values) as T | undefined) || null; }
  all<T>() { return { results: this.db.prepare(this.sql).all(...this.values) as T[] }; }
  run() {
    const result = this.db.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

export class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) { return new SqliteStatement(this.sqlite, sql); }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const result = statements.map((statement) => statement.run());
      this.sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  close() { this.sqlite.close(); }
}
