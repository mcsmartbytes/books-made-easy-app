// Client-side database utility - wraps API calls and NextAuth
// This maintains compatibility with existing code while using Neon backend

import { getSession } from 'next-auth/react';

// Type for query results - using any for compatibility with existing code
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResult<T = any> = {
  data: T | T[] | null;
  error: Error | null;
  count?: number;
};

// Mock auth interface for compatibility
const authInterface = {
  getSession: async () => {
    const session = await getSession();
    if (session?.user) {
      return {
        data: {
          session: {
            user: {
              id: (session.user as { id?: string }).id,
              email: session.user.email,
              user_metadata: {
                full_name: session.user.name,
              },
            },
          },
        },
        error: null,
      };
    }
    return { data: { session: null }, error: null };
  },
  getUser: async () => {
    const session = await getSession();
    if (session?.user) {
      return {
        data: {
          user: {
            id: (session.user as { id?: string }).id,
            email: session.user.email,
            user_metadata: {
              full_name: session.user.name,
            },
          },
        },
        error: null,
      };
    }
    return { data: { user: null }, error: null };
  },
};

// Query builder that fetches from API routes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ClientQueryBuilder<T = any> {
  private tableName: string;
  private selectColumns: string = '*';
  private whereConditions: { column: string; value: unknown; operator: string }[] = [];
  private orderByColumn: string | null = null;
  private orderDirection: 'asc' | 'desc' = 'asc';
  private limitValue: number | null = null;
  private isSingle: boolean = false;
  private countType: 'exact' | null = null;
  private insertData: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updateData: Record<string, unknown> | null = null;
  private upsertData: Record<string, unknown> | null = null;
  private upsertOptions: { onConflict?: string } = {};
  private isDelete: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns: string = '*', options?: { count?: 'exact' }): this {
    this.selectColumns = columns;
    if (options?.count) {
      this.countType = options.count;
    }
    return this;
  }

  eq(column: string, value: unknown): this {
    this.whereConditions.push({ column, value, operator: 'eq' });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.whereConditions.push({ column, value, operator: 'neq' });
    return this;
  }

  gt(column: string, value: unknown): this {
    this.whereConditions.push({ column, value, operator: 'gt' });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.whereConditions.push({ column, value, operator: 'gte' });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.whereConditions.push({ column, value, operator: 'lt' });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.whereConditions.push({ column, value, operator: 'lte' });
    return this;
  }

  like(column: string, value: string): this {
    this.whereConditions.push({ column, value, operator: 'like' });
    return this;
  }

  ilike(column: string, value: string): this {
    this.whereConditions.push({ column, value, operator: 'ilike' });
    return this;
  }

  is(column: string, value: unknown): this {
    this.whereConditions.push({ column, value, operator: 'is' });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.whereConditions.push({ column, value: values, operator: 'in' });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderByColumn = column;
    this.orderDirection = options?.ascending === false ? 'desc' : 'asc';
    return this;
  }

  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  single(): this {
    this.isSingle = true;
    this.limitValue = 1;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.updateData = data;
    return this;
  }

  upsert(data: Record<string, unknown>, options?: { onConflict?: string }): this {
    this.upsertData = data;
    if (options) this.upsertOptions = options;
    return this;
  }

  delete(): this {
    this.isDelete = true;
    return this;
  }

  async then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as unknown as TResult1;
    } catch (error) {
      if (onrejected) {
        return onrejected(error);
      }
      throw error;
    }
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      // Get current user for user_id
      const session = await getSession();
      const userId = (session?.user as { id?: string })?.id;

      // Build query params
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);

      for (const cond of this.whereConditions) {
        if (cond.column === 'user_id') continue; // Already added
        if (cond.operator === 'eq') {
          params.set(cond.column, String(cond.value));
        } else {
          params.set(`${cond.column}__${cond.operator}`, String(cond.value));
        }
      }

      if (this.orderByColumn) {
        params.set('order', `${this.orderByColumn}.${this.orderDirection}`);
      }
      if (this.limitValue) {
        params.set('limit', String(this.limitValue));
      }

      const apiUrl = `/api/${this.tableName}?${params.toString()}`;

      // INSERT operation
      if (this.insertData !== null) {
        const dataWithUser = Array.isArray(this.insertData)
          ? this.insertData.map(d => ({ ...d, user_id: userId }))
          : { ...this.insertData, user_id: userId };

        const response = await fetch(`/api/${this.tableName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataWithUser),
        });

        const result = await response.json();
        if (!response.ok) {
          return { data: null, error: new Error(result.error || 'Insert failed') };
        }

        if (this.isSingle) {
          return { data: result.data as T, error: null };
        }
        return { data: result.data as T[], error: null };
      }

      // UPSERT operation (handled as POST with upsert flag)
      if (this.upsertData !== null) {
        const dataWithUser = { ...this.upsertData, user_id: userId };

        const response = await fetch(`/api/${this.tableName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...dataWithUser,
            _upsert: true,
            _onConflict: this.upsertOptions.onConflict,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          return { data: null, error: new Error(result.error || 'Upsert failed') };
        }

        if (this.isSingle) {
          return { data: result.data as T, error: null };
        }
        return { data: result.data as T[], error: null };
      }

      // UPDATE operation
      if (this.updateData !== null) {
        const idCondition = this.whereConditions.find(c => c.column === 'id');
        const updateBody = {
          ...this.updateData,
          user_id: userId,
          id: idCondition?.value,
        };

        const response = await fetch(`/api/${this.tableName}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody),
        });

        const result = await response.json();
        if (!response.ok) {
          return { data: null, error: new Error(result.error || 'Update failed') };
        }

        if (this.isSingle) {
          return { data: result.data as T, error: null };
        }
        return { data: result.data as T[], error: null };
      }

      // DELETE operation
      if (this.isDelete) {
        const idCondition = this.whereConditions.find(c => c.column === 'id');
        const params = new URLSearchParams();
        if (idCondition) params.set('id', String(idCondition.value));
        if (userId) params.set('user_id', userId);

        const response = await fetch(`/api/${this.tableName}?${params.toString()}`, {
          method: 'DELETE',
        });

        const result = await response.json();
        if (!response.ok) {
          return { data: null, error: new Error(result.error || 'Delete failed') };
        }

        return { data: null, error: null };
      }

      // SELECT operation
      const response = await fetch(apiUrl);
      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: new Error(result.error || 'Fetch failed') };
      }

      const data = result.data || result;

      if (this.isSingle) {
        return { data: (Array.isArray(data) ? data[0] : data) as T, error: null };
      }

      if (this.countType === 'exact') {
        return {
          data: data as T[],
          error: null,
          count: Array.isArray(data) ? data.length : 0
        };
      }

      return { data: data as T[], error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

// Storage interface for file uploads
const storageInterface = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', bucket);
        formData.append('path', path);

        const response = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) {
          return { data: null, error: new Error(result.error || 'Upload failed') };
        }

        return { data: result.data, error: null };
      },
      async remove(paths: string[]) {
        const response = await fetch('/api/storage/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, paths }),
        });

        const result = await response.json();
        if (!response.ok) {
          return { data: null, error: new Error(result.error || 'Delete failed') };
        }

        return { data: result.data, error: null };
      },
      getPublicUrl(path: string) {
        // Return a URL pointing to an API route that serves the file
        return { data: { publicUrl: `/api/storage/serve?bucket=${bucket}&path=${encodeURIComponent(path)}` } };
      },
    };
  },
};

// Client-side Supabase-compatible interface
export const supabase = {
  auth: authInterface,
  storage: storageInterface,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from<T = any>(tableName: string) {
    return new ClientQueryBuilder<T>(tableName);
  },
  async rpc(fnName: string, params?: Record<string, unknown>) {
    const session = await getSession();
    const userId = (session?.user as { id?: string })?.id;

    const response = await fetch(`/api/rpc/${fnName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, user_id: userId }),
    });

    const result = await response.json();
    if (!response.ok) {
      return { data: null, error: new Error(result.error || 'RPC call failed') };
    }

    return { data: result.data, error: null };
  },
};

// Default export for compatibility
export default supabase;
