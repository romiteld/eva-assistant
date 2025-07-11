import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { usePagination, PaginationState, PaginationActions } from '@/hooks/usePagination';

export interface Column<T> {
  key: string;
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  sortable?: boolean;
  width?: string;
  className?: string;
}

export interface PaginatedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  totalItems?: number;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  onRowClick?: (item: T, index: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
}

export default function PaginatedTable<T extends { id?: string | number }>({
  data,
  columns,
  totalItems,
  pageSize: initialPageSize = 10,
  currentPage: externalCurrentPage,
  onPageChange,
  onSort,
  isLoading = false,
  emptyMessage = 'No data available',
  className = '',
  rowClassName = '',
  onRowClick,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true
}: PaginatedTableProps<T>) {
  const [paginationState, paginationActions] = usePagination({
    initialPage: externalCurrentPage || 1,
    initialPageSize,
    pageSizeOptions
  });

  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Update total items when data changes
  React.useEffect(() => {
    if (totalItems !== undefined) {
      paginationActions.setTotalItems(totalItems);
    } else {
      paginationActions.setTotalItems(data.length);
    }
  }, [totalItems, data.length, paginationActions]);

  // Handle external page changes
  React.useEffect(() => {
    if (externalCurrentPage && externalCurrentPage !== paginationState.currentPage) {
      paginationActions.setPage(externalCurrentPage);
    }
  }, [externalCurrentPage, paginationState.currentPage, paginationActions]);

  // Handle page changes
  const handlePageChange = (page: number) => {
    paginationActions.setPage(page);
    onPageChange?.(page, paginationState.pageSize);
  };

  // Handle page size changes
  const handlePageSizeChange = (size: number) => {
    paginationActions.setPageSize(size);
    onPageChange?.(1, size); // Reset to first page
  };

  // Handle sorting
  const handleSort = (columnKey: string) => {
    if (!onSort) return;

    let newDirection: 'asc' | 'desc' = 'asc';
    if (sortColumn === columnKey && sortDirection === 'asc') {
      newDirection = 'desc';
    }

    setSortColumn(columnKey);
    setSortDirection(newDirection);
    onSort(columnKey, newDirection);
  };

  // Get paginated data
  const paginatedData = totalItems !== undefined 
    ? data // Data is already paginated from server
    : data.slice(paginationState.startIndex, paginationState.endIndex);

  // Render cell content
  const renderCell = (item: T, column: Column<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }
    return item[column.accessor] as ReactNode;
  };

  // Get row class name
  const getRowClassName = (item: T, index: number) => {
    if (typeof rowClassName === 'function') {
      return rowClassName(item, index);
    }
    return rowClassName;
  };

  return (
    <div className={`${className}`}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              {columns.map((column: Column<T>) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-sm font-medium text-gray-300 ${
                    column.sortable ? 'cursor-pointer hover:text-white' : ''
                  } ${column.className || ''}`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-xs">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8">
                  <div className="flex items-center justify-center space-x-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${getRowClassName(item, index)}`}
                  onClick={() => onRowClick?.(item, index)}
                >
                  {columns.map((column: Column<T>) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-sm ${column.className || ''}`}
                    >
                      {renderCell(item, column)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
        <div className="flex items-center space-x-4">
          {showPageSizeSelector && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">Show</span>
              <select
                value={paginationState.pageSize}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handlePageSizeChange(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pageSizeOptions.map((size: number) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-400">entries</span>
            </div>
          )}
          
          <div className="text-sm text-gray-400">
            Showing {paginationState.startIndex + 1} to {paginationState.endIndex} of{' '}
            {paginationState.totalItems} entries
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(1)}
            disabled={!paginationState.hasPreviousPage}
            className="p-1 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => paginationActions.previousPage()}
            disabled={!paginationState.hasPreviousPage}
            className="p-1 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-1">
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, paginationState.totalPages) }, (_, i) => {
              let pageNumber: number;
              if (paginationState.totalPages <= 5) {
                pageNumber = i + 1;
              } else if (paginationState.currentPage <= 3) {
                pageNumber = i + 1;
              } else if (paginationState.currentPage >= paginationState.totalPages - 2) {
                pageNumber = paginationState.totalPages - 4 + i;
              } else {
                pageNumber = paginationState.currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNumber}
                  onClick={() => handlePageChange(pageNumber)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    pageNumber === paginationState.currentPage
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-800 text-gray-400'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => paginationActions.nextPage()}
            disabled={!paginationState.hasNextPage}
            className="p-1 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handlePageChange(paginationState.totalPages)}
            disabled={!paginationState.hasNextPage}
            className="p-1 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}