declare module 'react-window-infinite-loader' {
  import { ComponentType, ReactElement, Ref } from 'react';

  export interface InfiniteLoaderProps {
    children: (props: {
      onItemsRendered: (props: {
        overscanStartIndex: number;
        overscanStopIndex: number;
        visibleStartIndex: number;
        visibleStopIndex: number;
      }) => void;
      ref: Ref<any>;
    }) => ReactElement;
    isItemLoaded: (index: number) => boolean;
    itemCount: number;
    loadMoreItems: (startIndex: number, stopIndex: number) => Promise<void> | void;
    minimumBatchSize?: number;
    threshold?: number;
  }

  const InfiniteLoader: ComponentType<InfiniteLoaderProps>;
  export default InfiniteLoader;
}