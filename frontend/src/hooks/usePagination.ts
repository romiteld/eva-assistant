import { useState, useCallback, useMemo } from 'react';

export interface PaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationActions {
  setPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  setTotalItems: (total: number) => void;
  reset: () => void;
}

export function usePagination(
  options: PaginationOptions = {}
): [PaginationState, PaginationActions] {
  const {
    initialPage = 1,
    initialPageSize = 10,
    pageSizeOptions = [10, 20, 50, 100]
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalItems, setTotalItemsState] = useState(0);

  // Calculate derived state
  const paginationState = useMemo<PaginationState>(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = Math.max(0, (currentPage - 1) * pageSize);
    const endIndex = Math.min(totalItems, startIndex + pageSize);
    
    return {
      currentPage,
      pageSize,
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    };
  }, [currentPage, pageSize, totalItems]);

  // Actions
  const setPage = useCallback((page: number) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
  }, [totalItems, pageSize]);

  const nextPage = useCallback(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalItems, pageSize]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  const setPageSize = useCallback((size: number) => {
    // Validate page size
    const validSize = pageSizeOptions.includes(size) ? size : initialPageSize;
    setPageSizeState(validSize);
    
    // Reset to first page when changing page size
    setCurrentPage(1);
  }, [pageSizeOptions, initialPageSize]);

  const setTotalItems = useCallback((total: number) => {
    setTotalItemsState(Math.max(0, total));
    
    // Adjust current page if it's out of bounds
    const newTotalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    }
  }, [currentPage, pageSize]);

  const reset = useCallback(() => {
    setCurrentPage(initialPage);
    setPageSizeState(initialPageSize);
    setTotalItemsState(0);
  }, [initialPage, initialPageSize]);

  const actions: PaginationActions = {
    setPage,
    nextPage,
    previousPage,
    setPageSize,
    setTotalItems,
    reset
  };

  return [paginationState, actions];
}

// Hook for server-side pagination with loading states
export interface ServerPaginationOptions extends PaginationOptions {
  onPageChange?: (page: number, pageSize: number) => void | Promise<void>;
}

export function useServerPagination(options: ServerPaginationOptions = {}) {
  const { onPageChange, ...paginationOptions } = options;
  const [state, actions] = usePagination(paginationOptions);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handlePageChange = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      actions.setPage(page);
      if (onPageChange) {
        await onPageChange(page, state.pageSize);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to change page'));
    } finally {
      setIsLoading(false);
    }
  }, [actions, onPageChange, state.pageSize]);

  const handlePageSizeChange = useCallback(async (size: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      actions.setPageSize(size);
      if (onPageChange) {
        await onPageChange(1, size); // Reset to first page
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to change page size'));
    } finally {
      setIsLoading(false);
    }
  }, [actions, onPageChange]);

  return {
    ...state,
    isLoading,
    error,
    setPage: handlePageChange,
    nextPage: () => handlePageChange(state.currentPage + 1),
    previousPage: () => handlePageChange(state.currentPage - 1),
    setPageSize: handlePageSizeChange,
    setTotalItems: actions.setTotalItems,
    reset: actions.reset
  };
}