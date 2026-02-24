import { getTursoClient, execSql } from './turso';

export function getSql() {
  return getTursoClient();
}

export { execSql };

// Tagged template literal support for migration compatibility
// Usage: const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
export async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  let query = '';
  const args: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      query += '?';
      args.push(values[i]);
    }
  }

  return execSql(query, args);
}
