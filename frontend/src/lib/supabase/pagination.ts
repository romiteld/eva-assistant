import { supabase } from './client';
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class PaginationHelper {
  /**
   * Apply pagination to a Supabase query
   */
  static applyPagination<T>(
    query: PostgrestFilterBuilder<any, any, T[]>,
    params: PaginationParams
  ) {
    const { page, pageSize, sortBy, sortDirection = 'desc' } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Apply sorting if specified
    if (sortBy) {
      query = query.order(sortBy, { ascending: sortDirection === 'asc' });
    }

    // Apply pagination
    return query.range(from, to);
  }

  /**
   * Execute a paginated query with total count
   */
  static async executePaginatedQuery<T>(
    tableName: string,
    params: PaginationParams,
    buildQuery?: (query: any) => any
  ): Promise<PaginatedResponse<T>> {
    try {
      // Build base query
      let countQuery = supabase.from(tableName).select('*', { count: 'exact', head: true });
      let dataQuery = supabase.from(tableName).select('*');

      // Apply filters if provided
      if (params.filters) {
        Object.entries(params.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            countQuery = countQuery.eq(key, value);
            dataQuery = dataQuery.eq(key, value);
          }
        });
      }

      // Apply custom query builder if provided
      if (buildQuery) {
        countQuery = buildQuery(countQuery);
        dataQuery = buildQuery(dataQuery);
      }

      // Get total count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // Apply pagination and sorting
      dataQuery = this.applyPagination(dataQuery, params);

      // Execute data query
      const { data, error: dataError } = await dataQuery;
      if (dataError) throw dataError;

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / params.pageSize);

      return {
        data: data || [],
        totalCount,
        page: params.page,
        pageSize: params.pageSize,
        totalPages
      };
    } catch (error) {
      console.error('Pagination error:', error);
      throw error;
    }
  }

  /**
   * Create a cursor-based pagination helper for real-time/infinite scroll
   */
  static async executeCursorPagination<T>(
    tableName: string,
    params: {
      cursor?: string | number;
      limit: number;
      direction?: 'before' | 'after';
      sortBy?: string;
      filters?: Record<string, any>;
    }
  ): Promise<{
    data: T[];
    nextCursor?: string | number;
    previousCursor?: string | number;
    hasMore: boolean;
  }> {
    const { cursor, limit, direction = 'after', sortBy = 'created_at', filters } = params;

    try {
      let query = supabase.from(tableName).select('*');

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            query = query.eq(key, value);
          }
        });
      }

      // Apply cursor
      if (cursor) {
        if (direction === 'after') {
          query = query.gt(sortBy, cursor);
        } else {
          query = query.lt(sortBy, cursor);
        }
      }

      // Apply sorting and limit (fetch one extra to check hasMore)
      query = query
        .order(sortBy, { ascending: direction === 'after' })
        .limit(limit + 1);

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];
      const hasMore = items.length > limit;
      
      // Remove the extra item
      if (hasMore) {
        items.pop();
      }

      // Determine cursors
      const nextCursor = items.length > 0 ? items[items.length - 1][sortBy] : undefined;
      const previousCursor = items.length > 0 ? items[0][sortBy] : undefined;

      return {
        data: items,
        nextCursor: hasMore ? nextCursor : undefined,
        previousCursor: cursor ? previousCursor : undefined,
        hasMore
      };
    } catch (error) {
      console.error('Cursor pagination error:', error);
      throw error;
    }
  }
}

// Specific pagination functions for different entities

export async function getPaginatedTasks(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  return PaginationHelper.executePaginatedQuery('tasks', params, (query) => 
    query.eq('user_id', userId)
  );
}

export async function getPaginatedCandidates(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  return PaginationHelper.executePaginatedQuery('candidates', params, (query) => 
    query.eq('user_id', userId)
  );
}

export async function getPaginatedConversations(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  return PaginationHelper.executePaginatedQuery('conversations', params, (query) => 
    query.eq('user_id', userId)
  );
}

export async function getPaginatedWorkflows(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  return PaginationHelper.executePaginatedQuery('workflows', params, (query) => 
    query.eq('user_id', userId)
  );
}

export async function getPaginatedPlacements(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  return PaginationHelper.executePaginatedQuery('placements', params, (query) => 
    query.eq('user_id', userId)
  );
}

export async function getPaginatedCommunications(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  return PaginationHelper.executePaginatedQuery('communications', params, (query) => 
    query.eq('user_id', userId)
  );
}

// Cursor-based pagination for chat messages
export async function getCursorPaginatedMessages(
  conversationId: string,
  params: {
    cursor?: string;
    limit?: number;
    direction?: 'before' | 'after';
  }
) {
  return PaginationHelper.executeCursorPagination('messages', {
    ...params,
    limit: params.limit || 50,
    filters: { conversation_id: conversationId },
    sortBy: 'created_at'
  });
}