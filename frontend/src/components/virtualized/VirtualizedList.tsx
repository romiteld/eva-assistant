import React, { forwardRef, useCallback, useRef, useImperativeHandle } from 'react';
import { FixedSizeList, VariableSizeList, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Loader2 } from 'lucide-react';

export interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight?: number | ((index: number) => number);
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  onLoadMore?: () => void | Promise<void>;
  hasMore?: boolean;
  isLoading?: boolean;
  threshold?: number;
  overscan?: number;
  className?: string;
  emptyMessage?: string;
  loadingComponent?: React.ReactNode;
}

export interface VirtualizedListRef {
  scrollToItem: (index: number, align?: 'start' | 'center' | 'end' | 'smart') => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

function VirtualizedListInner<T>(
  props: VirtualizedListProps<T>,
  ref: React.Ref<VirtualizedListRef>
) {
  const {
    items,
    height,
    itemHeight = 50,
    renderItem,
    onLoadMore,
    hasMore = false,
    isLoading = false,
    threshold = 15,
    overscan = 3,
    className = '',
    emptyMessage = 'No items to display',
    loadingComponent
  } = props;

  const listRef = useRef<any>(null);
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    scrollToItem: (index: number, align?: 'start' | 'center' | 'end' | 'smart') => {
      listRef.current?.scrollToItem(index, align);
    },
    scrollToTop: () => {
      listRef.current?.scrollToItem(0, 'start');
    },
    scrollToBottom: () => {
      listRef.current?.scrollToItem(items.length - 1, 'end');
    }
  }));

  // Calculate total items including loading indicator
  const itemCount = hasMore ? items.length + 1 : items.length;

  // Check if an item is loaded
  const isItemLoaded = useCallback((index: number) => {
    return !hasMore || index < items.length;
  }, [hasMore, items.length]);

  // Load more items
  const loadMoreItems = useCallback(async () => {
    if (!isLoading && onLoadMore) {
      await onLoadMore();
    }
  }, [isLoading, onLoadMore]);

  // Render a single row
  const Row = ({ index, style }: ListChildComponentProps) => {
    if (!isItemLoaded(index)) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          {loadingComponent || (
            <div className="flex items-center space-x-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more...</span>
            </div>
          )}
        </div>
      );
    }

    const item = items[index];
    if (!item) return null;

    return <>{renderItem(item, index, style)}</>;
  };

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <div 
        className={`flex items-center justify-center text-gray-400 ${className}`}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  // Variable height list
  if (typeof itemHeight === 'function') {
    return (
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={itemCount}
        loadMoreItems={loadMoreItems}
        threshold={threshold}
      >
        {({ onItemsRendered, ref: loaderRef }) => (
          <VariableSizeList
            ref={(list) => {
              listRef.current = list;
              if (typeof loaderRef === 'function') loaderRef(list);
            }}
            className={className}
            height={height}
            width="100%"
            itemCount={itemCount}
            itemSize={itemHeight}
            onItemsRendered={onItemsRendered}
            overscanCount={overscan}
          >
            {Row}
          </VariableSizeList>
        )}
      </InfiniteLoader>
    );
  }

  // Fixed height list
  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
      threshold={threshold}
    >
      {({ onItemsRendered, ref: loaderRef }) => (
        <FixedSizeList
          ref={(list) => {
            listRef.current = list;
            if (typeof loaderRef === 'function') loaderRef(list);
          }}
          className={className}
          height={height}
          width="100%"
          itemCount={itemCount}
          itemSize={itemHeight}
          onItemsRendered={onItemsRendered}
          overscanCount={overscan}
        >
          {Row}
        </FixedSizeList>
      )}
    </InfiniteLoader>
  );
}

export const VirtualizedList = forwardRef(VirtualizedListInner) as <T>(
  props: VirtualizedListProps<T> & { ref?: React.Ref<VirtualizedListRef> }
) => React.ReactElement;