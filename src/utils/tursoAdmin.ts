import { execSql } from '@/lib/turso';

// FK relationship map: maps relation table name to the FK column in the parent table
// or the FK column in the child table (for has-many relations)
const RELATION_MAP: Record<string, Record<string, { fk: string; type: 'belongs_to' | 'has_many' }>> = {
  invoices: {
    customers: { fk: 'customer_id', type: 'belongs_to' },
    invoice_items: { fk: 'invoice_id', type: 'has_many' },
  },
  bills: {
    vendors: { fk: 'vendor_id', type: 'belongs_to' },
    bill_items: { fk: 'bill_id', type: 'has_many' },
  },
  vendors: {
    bills: { fk: 'vendor_id', type: 'has_many' },
  },
  payments_received: {
    invoices: { fk: 'invoice_id', type: 'belongs_to' },
    customers: { fk: 'customer_id', type: 'belongs_to' },
  },
  payments_made: {
    bills: { fk: 'bill_id', type: 'belongs_to' },
    vendors: { fk: 'vendor_id', type: 'belongs_to' },
  },
  expenses: {
    categories: { fk: 'category_id', type: 'belongs_to' },
    jobs: { fk: 'job_id', type: 'belongs_to' },
  },
  merchant_rules: {
    categories: { fk: 'category_id', type: 'belongs_to' },
  },
  item_category_rules: {
    categories: { fk: 'category_id', type: 'belongs_to' },
  },
  recurring_expenses: {
    categories: { fk: 'category_id', type: 'belongs_to' },
  },
  products_services: {
    categories: { fk: 'category_id', type: 'belongs_to' },
  },
};

interface ParsedSelect {
  baseColumns: string;
  relations: { table: string; columns: string; innerJoin: boolean }[];
}

function parseSelectString(selectStr: string): ParsedSelect {
  const relations: { table: string; columns: string; innerJoin: boolean }[] = [];
  let baseColumns = selectStr;

  // Match patterns like "tableName(col1, col2)" or "tableName!inner(col1, col2)"
  const relationRegex = /,?\s*(\w+)(!inner)?\(([^)]*)\)/g;
  let match;

  while ((match = relationRegex.exec(selectStr)) !== null) {
    relations.push({
      table: match[1],
      columns: match[3].trim(),
      innerJoin: !!match[2],
    });
    baseColumns = baseColumns.replace(match[0], '');
  }

  baseColumns = baseColumns.replace(/,\s*$/, '').replace(/^\s*,/, '').trim();
  if (!baseColumns) baseColumns = '*';

  return { baseColumns, relations };
}

async function fetchRelation(
  mainTableName: string,
  mainRows: Record<string, unknown>[],
  relation: { table: string; columns: string; innerJoin: boolean },
): Promise<void> {
  if (mainRows.length === 0) return;

  const relConfig = RELATION_MAP[mainTableName]?.[relation.table];
  if (!relConfig) {
    // Try to infer: check if main table has `singular(relTable)_id`
    const singularName = relation.table.replace(/s$/, '');
    const possibleFk = `${singularName}_id`;
    if (mainRows[0] && possibleFk in mainRows[0]) {
      await fetchBelongsTo(mainRows, relation, possibleFk);
    } else {
      // Try has-many: check if child table has `singular(mainTable)_id`
      const mainSingular = mainTableName.replace(/s$/, '');
      await fetchHasMany(mainRows, relation, `${mainSingular}_id`);
    }
    return;
  }

  if (relConfig.type === 'belongs_to') {
    await fetchBelongsTo(mainRows, relation, relConfig.fk);
  } else {
    await fetchHasMany(mainRows, relation, relConfig.fk);
  }
}

async function fetchBelongsTo(
  mainRows: Record<string, unknown>[],
  relation: { table: string; columns: string; innerJoin: boolean },
  fkColumn: string,
): Promise<void> {
  const fkValues = [...new Set(
    mainRows.map(r => r[fkColumn]).filter(v => v != null)
  )];

  if (fkValues.length === 0) {
    for (const row of mainRows) {
      row[relation.table] = null;
    }
    return;
  }

  const placeholders = fkValues.map(() => '?').join(', ');
  const cols = relation.columns === '*' ? '*' : `id, ${relation.columns}`;
  const query = `SELECT ${cols} FROM "${relation.table}" WHERE "id" IN (${placeholders})`;
  const related = await execSql(query, fkValues);

  const relatedMap = new Map<string, Record<string, unknown>>();
  for (const r of related) {
    relatedMap.set(String(r.id), r);
  }

  for (const row of mainRows) {
    const fkVal = row[fkColumn];
    row[relation.table] = fkVal != null ? (relatedMap.get(String(fkVal)) || null) : null;
  }

  if (relation.innerJoin) {
    const toRemove = mainRows.filter(r => r[relation.table] == null);
    for (const r of toRemove) {
      const idx = mainRows.indexOf(r);
      if (idx >= 0) mainRows.splice(idx, 1);
    }
  }
}

async function fetchHasMany(
  mainRows: Record<string, unknown>[],
  relation: { table: string; columns: string },
  fkColumn: string,
): Promise<void> {
  const idValues = [...new Set(
    mainRows.map(r => r.id).filter(v => v != null)
  )];

  if (idValues.length === 0) {
    for (const row of mainRows) {
      row[relation.table] = [];
    }
    return;
  }

  const placeholders = idValues.map(() => '?').join(', ');
  const cols = relation.columns === '*' ? '*' : `"${fkColumn}", ${relation.columns}`;
  const query = `SELECT ${cols} FROM "${relation.table}" WHERE "${fkColumn}" IN (${placeholders})`;
  const related = await execSql(query, idValues);

  const relatedMap = new Map<string, Record<string, unknown>[]>();
  for (const r of related) {
    const key = String(r[fkColumn]);
    if (!relatedMap.has(key)) relatedMap.set(key, []);
    relatedMap.get(key)!.push(r);
  }

  for (const row of mainRows) {
    row[relation.table] = relatedMap.get(String(row.id)) || [];
  }
}

// --- Query Builders ---

interface QueryResult<T> {
  data: T[] | null;
  error: Error | null;
}

interface SingleQueryResult<T> {
  data: T | null;
  error: Error | null;
}

type WhereCondition = { column: string; value: unknown; operator: string };

function buildWhereClause(conditions: WhereCondition[], _paramOffset: number = 0): { clause: string; values: unknown[] } {
  if (conditions.length === 0) return { clause: '', values: [] };

  const clauses: string[] = [];
  const values: unknown[] = [];

  for (const cond of conditions) {
    if (cond.operator === 'IS') {
      clauses.push(`"${cond.column}" IS ${cond.value === null ? 'NULL' : 'NOT NULL'}`);
    } else if (cond.operator === 'IS NOT') {
      clauses.push(`"${cond.column}" IS NOT NULL`);
    } else if (cond.operator === 'IN') {
      const inValues = cond.value as unknown[];
      const placeholders = inValues.map(() => '?').join(', ');
      clauses.push(`"${cond.column}" IN (${placeholders})`);
      values.push(...inValues);
    } else {
      clauses.push(`"${cond.column}" ${cond.operator} ?`);
      values.push(cond.value);
    }
  }

  return { clause: `WHERE ${clauses.join(' AND ')}`, values };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class TursoQueryBuilder<T = any> {
  private tableName: string;
  private selectColumns: string = '*';
  private whereConditions: WhereCondition[] = [];
  private orderByClauses: { column: string; direction: 'ASC' | 'DESC' }[] = [];
  private limitValue: number | null = null;
  private isSingle: boolean = false;
  private insertData: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updateData: Record<string, unknown> | null = null;
  private shouldSelect: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*', _options?: { count?: 'exact' | 'planned' | 'estimated' }): TursoQueryBuilder<T> {
    this.selectColumns = columns;
    this.shouldSelect = true;
    return this;
  }

  eq(column: string, value: unknown): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: '=' });
    return this;
  }

  neq(column: string, value: unknown): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: '!=' });
    return this;
  }

  gt(column: string, value: unknown): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: '>' });
    return this;
  }

  gte(column: string, value: unknown): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: '>=' });
    return this;
  }

  lt(column: string, value: unknown): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: '<' });
    return this;
  }

  lte(column: string, value: unknown): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: '<=' });
    return this;
  }

  like(column: string, value: string): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: 'LIKE' });
    return this;
  }

  ilike(column: string, value: string): TursoQueryBuilder<T> {
    // SQLite LIKE is case-insensitive for ASCII by default
    this.whereConditions.push({ column, value, operator: 'LIKE' });
    return this;
  }

  is(column: string, value: unknown): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value, operator: 'IS' });
    return this;
  }

  not(column: string, operator: string, value: unknown): TursoQueryBuilder<T> {
    if (operator === 'is' && value === null) {
      this.whereConditions.push({ column, value: null, operator: 'IS NOT' });
    } else {
      this.whereConditions.push({ column, value, operator: `NOT ${operator.toUpperCase()}` });
    }
    return this;
  }

  in(column: string, values: unknown[]): TursoQueryBuilder<T> {
    this.whereConditions.push({ column, value: values, operator: 'IN' });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): TursoQueryBuilder<T> {
    this.orderByClauses.push({
      column,
      direction: options?.ascending === false ? 'DESC' : 'ASC',
    });
    return this;
  }

  limit(count: number): TursoQueryBuilder<T> {
    this.limitValue = count;
    return this;
  }

  single(): TursoSingleQueryBuilder<T> {
    this.isSingle = true;
    this.limitValue = 1;
    return new TursoSingleQueryBuilder(this);
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): TursoQueryBuilder<T> {
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): TursoQueryBuilder<T> {
    this.updateData = data;
    return this;
  }

  upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): TursoUpsertBuilder<T> {
    return new TursoUpsertBuilder<T>(this.tableName, data, options?.onConflict, options?.ignoreDuplicates);
  }

  delete(): TursoDeleteFromBuilder {
    return new TursoDeleteFromBuilder(this.tableName, this.whereConditions);
  }

  async then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : result as unknown as TResult1;
    } catch (error) {
      if (onrejected) return onrejected(error);
      throw error;
    }
  }

  async execute(): Promise<QueryResult<T>> {
    try {
      // INSERT
      if (this.insertData !== null) {
        const dataArray = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        if (dataArray.length === 0) return { data: [], error: null };

        // Auto-generate IDs if not provided
        for (const row of dataArray) {
          if (!row.id) {
            row.id = crypto.randomUUID();
          }
        }

        const columns = Object.keys(dataArray[0]);
        const columnList = columns.map(c => `"${c}"`).join(', ');
        const allValues: unknown[] = [];
        const valueRows: string[] = [];

        for (const row of dataArray) {
          const placeholders = columns.map(() => '?');
          for (const col of columns) {
            allValues.push(row[col] ?? null);
          }
          valueRows.push(`(${placeholders.join(', ')})`);
        }

        const query = `INSERT INTO "${this.tableName}" (${columnList}) VALUES ${valueRows.join(', ')} RETURNING *`;
        const result = await execSql(query, allValues);
        return { data: result as T[], error: null };
      }

      // UPDATE
      if (this.updateData !== null) {
        const columns = Object.keys(this.updateData);
        const setClauses = columns.map(c => `"${c}" = ?`);
        const values: unknown[] = columns.map(c => this.updateData![c] ?? null);

        const { clause: whereClause, values: whereValues } = buildWhereClause(this.whereConditions);
        values.push(...whereValues);

        const query = `UPDATE "${this.tableName}" SET ${setClauses.join(', ')} ${whereClause} RETURNING *`;
        const result = await execSql(query, values);
        return { data: result as T[], error: null };
      }

      // SELECT with relation support
      const parsed = parseSelectString(this.selectColumns);
      const { clause: whereClause, values: whereValues } = buildWhereClause(this.whereConditions);

      let query = `SELECT ${parsed.baseColumns} FROM "${this.tableName}" ${whereClause}`;

      if (this.orderByClauses.length > 0) {
        const orderParts = this.orderByClauses.map(o => `"${o.column}" ${o.direction}`);
        query += ` ORDER BY ${orderParts.join(', ')}`;
      }
      if (this.limitValue !== null) {
        query += ` LIMIT ${this.limitValue}`;
      }

      const rows = await execSql(query, whereValues) as Record<string, unknown>[];

      // Fetch relations
      for (const rel of parsed.relations) {
        await fetchRelation(this.tableName, rows, rel);
      }

      return { data: rows as T[], error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  getState() {
    return {
      tableName: this.tableName,
      selectColumns: this.selectColumns,
      whereConditions: this.whereConditions,
      orderByClauses: this.orderByClauses,
      limitValue: this.limitValue,
      insertData: this.insertData,
      updateData: this.updateData,
      shouldSelect: this.shouldSelect,
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class TursoSingleQueryBuilder<T = any> {
  private parent: TursoQueryBuilder<T>;

  constructor(parent: TursoQueryBuilder<T>) {
    this.parent = parent;
  }

  select(columns: string = '*'): TursoSingleQueryBuilder<T> {
    this.parent.select(columns);
    return this;
  }

  async then<TResult1 = SingleQueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: SingleQueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.parent.execute();
      const singleResult: SingleQueryResult<T> = {
        data: result.data && result.data.length > 0 ? result.data[0] : null,
        error: result.error,
      };
      return onfulfilled ? onfulfilled(singleResult) : singleResult as unknown as TResult1;
    } catch (error) {
      if (onrejected) return onrejected(error);
      throw error;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class TursoUpsertBuilder<T = any> {
  private tableName: string;
  private data: Record<string, unknown> | Record<string, unknown>[];
  private conflictColumn: string | undefined;
  private ignoreDuplicates: boolean;
  private selectColumns: string = '*';
  private isSingle: boolean = false;

  constructor(
    tableName: string,
    data: Record<string, unknown> | Record<string, unknown>[],
    conflictColumn?: string,
    ignoreDuplicates?: boolean,
  ) {
    this.tableName = tableName;
    this.data = data;
    this.conflictColumn = conflictColumn;
    this.ignoreDuplicates = ignoreDuplicates || false;
  }

  select(columns: string = '*'): TursoUpsertBuilder<T> {
    this.selectColumns = columns;
    return this;
  }

  single(): TursoUpsertBuilder<T> {
    this.isSingle = true;
    return this;
  }

  async then<TResult1 = { data: T | T[] | null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | T[] | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      const finalResult = this.isSingle
        ? { data: result.data && result.data.length > 0 ? result.data[0] : null, error: result.error }
        : result;
      return onfulfilled ? onfulfilled(finalResult) : finalResult as unknown as TResult1;
    } catch (error) {
      if (onrejected) return onrejected(error);
      throw error;
    }
  }

  private async execute(): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const dataArray = Array.isArray(this.data) ? this.data : [this.data];
      if (dataArray.length === 0) return { data: [], error: null };

      for (const row of dataArray) {
        if (!row.id) row.id = crypto.randomUUID();
      }

      const columns = Object.keys(dataArray[0]);
      const columnList = columns.map(c => `"${c}"`).join(', ');
      const allValues: unknown[] = [];
      const valueRows: string[] = [];

      for (const row of dataArray) {
        const placeholders = columns.map(() => '?');
        for (const col of columns) {
          allValues.push(row[col] ?? null);
        }
        valueRows.push(`(${placeholders.join(', ')})`);
      }

      const conflictCol = this.conflictColumn || 'id';
      let onConflictClause: string;

      if (this.ignoreDuplicates) {
        onConflictClause = `ON CONFLICT ("${conflictCol}") DO NOTHING`;
      } else {
        const updateClauses = columns
          .filter(c => c !== conflictCol)
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');
        onConflictClause = `ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateClauses}`;
      }

      const query = `INSERT INTO "${this.tableName}" (${columnList}) VALUES ${valueRows.join(', ')} ${onConflictClause} RETURNING ${this.selectColumns}`;
      const result = await execSql(query, allValues);
      return { data: result as T[], error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

class TursoDeleteFromBuilder {
  private tableName: string;
  private whereConditions: WhereCondition[];

  constructor(tableName: string, existingConditions: WhereCondition[] = []) {
    this.tableName = tableName;
    this.whereConditions = [...existingConditions];
  }

  eq(column: string, value: unknown): TursoDeleteFromBuilder {
    this.whereConditions.push({ column, value, operator: '=' });
    return this;
  }

  neq(column: string, value: unknown): TursoDeleteFromBuilder {
    this.whereConditions.push({ column, value, operator: '!=' });
    return this;
  }

  in(column: string, values: unknown[]): TursoDeleteFromBuilder {
    this.whereConditions.push({ column, value: values, operator: 'IN' });
    return this;
  }

  async then<TResult1 = { data: null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : result as unknown as TResult1;
    } catch (error) {
      if (onrejected) return onrejected(error);
      throw error;
    }
  }

  private async execute(): Promise<{ data: null; error: Error | null }> {
    try {
      const { clause: whereClause, values: whereValues } = buildWhereClause(this.whereConditions);
      const query = `DELETE FROM "${this.tableName}" ${whereClause}`;
      await execSql(query, whereValues);
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

class TursoDeleteBuilder {
  private tableName: string;
  private whereConditions: WhereCondition[] = [];

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  eq(column: string, value: unknown): TursoDeleteBuilder {
    this.whereConditions.push({ column, value, operator: '=' });
    return this;
  }

  async then<TResult1 = { data: null; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: null; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : result as unknown as TResult1;
    } catch (error) {
      if (onrejected) return onrejected(error);
      throw error;
    }
  }

  private async execute(): Promise<{ data: null; error: Error | null }> {
    try {
      const { clause: whereClause, values: whereValues } = buildWhereClause(this.whereConditions);
      const query = `DELETE FROM "${this.tableName}" ${whereClause}`;
      await execSql(query, whereValues);
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

// Main client - drop-in replacement for neonAdmin / supabaseAdmin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tursoAdmin = {
  from<T = Record<string, unknown>>(tableName: string): TursoQueryBuilder<T> {
    return new TursoQueryBuilder<T>(tableName);
  },
  delete(tableName: string): TursoDeleteBuilder {
    return new TursoDeleteBuilder(tableName);
  },
};

export function getTursoAdmin() {
  return tursoAdmin;
}
