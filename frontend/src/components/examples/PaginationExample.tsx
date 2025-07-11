import React, { useState } from 'react';
import { FileText, Users, CheckSquare, MessageSquare, Calendar } from 'lucide-react';
import PaginatedTable from '../virtualized/PaginatedTable';
import { VirtualizedList } from '../virtualized/VirtualizedList';
import InfiniteScrollChat from '../virtualized/InfiniteScrollChat';
import { usePagination } from '@/hooks/usePagination';

// Sample data generators
const generateSampleData = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i + 1}`,
    description: `Description for item ${i + 1}`,
    status: ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)],
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    value: Math.floor(Math.random() * 1000)
  }));
};

const generateMessages = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    content: `This is message ${i + 1}. ${i % 3 === 0 ? 'This is a longer message that contains more content to demonstrate variable height rendering in the chat interface.' : ''}`,
    role: i % 2 === 0 ? 'user' : 'assistant' as 'user' | 'assistant',
    timestamp: new Date(Date.now() - (count - i) * 60000).toISOString()
  }));
};

export default function PaginationExample() {
  const [activeExample, setActiveExample] = useState<'table' | 'virtualized' | 'chat'>('table');
  
  // Table pagination example
  const tableData = generateSampleData(250);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  
  // Virtualized list example
  const listData = generateSampleData(10000);
  const [listItems, setListItems] = useState(listData.slice(0, 100));
  const [hasMore, setHasMore] = useState(true);
  
  // Chat example
  const [messages] = useState(generateMessages(50));
  
  const handleLoadMore = async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const currentLength = listItems.length;
    const nextItems = listData.slice(currentLength, currentLength + 50);
    
    if (nextItems.length > 0) {
      setListItems(prev => [...prev, ...nextItems]);
      setHasMore(currentLength + 50 < listData.length);
    } else {
      setHasMore(false);
    }
  };

  const examples = [
    { id: 'table', label: 'Paginated Table', icon: FileText },
    { id: 'virtualized', label: 'Virtualized List', icon: Users },
    { id: 'chat', label: 'Infinite Chat', icon: MessageSquare }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h1 className="text-2xl font-bold mb-4">Pagination & Virtualization Examples</h1>
        
        {/* Example selector */}
        <div className="flex space-x-4 mb-6">
          {examples.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveExample(id as any)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
                activeExample === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Paginated Table Example */}
        {activeExample === 'table' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Paginated Table</h3>
              <p className="text-sm text-gray-400 mb-4">
                Server-side pagination with sorting and page size selection
              </p>
              
              <PaginatedTable
                data={tableData.slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize)}
                columns={[
                  {
                    key: 'name',
                    header: 'Name',
                    accessor: 'name',
                    sortable: true
                  },
                  {
                    key: 'description',
                    header: 'Description',
                    accessor: 'description'
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    accessor: (item) => (
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status === 'active' ? 'bg-green-900/50 text-green-300' :
                        item.status === 'pending' ? 'bg-yellow-900/50 text-yellow-300' :
                        'bg-gray-900/50 text-gray-300'
                      }`}>
                        {item.status}
                      </span>
                    ),
                    sortable: true
                  },
                  {
                    key: 'value',
                    header: 'Value',
                    accessor: (item) => `$${item.value}`,
                    sortable: true
                  },
                  {
                    key: 'date',
                    header: 'Date',
                    accessor: (item) => new Date(item.date).toLocaleDateString(),
                    sortable: true
                  }
                ]}
                totalItems={tableData.length}
                pageSize={tablePageSize}
                currentPage={tablePage}
                onPageChange={(page, size) => {
                  setTablePage(page);
                  setTablePageSize(size);
                }}
                pageSizeOptions={[5, 10, 20, 50]}
                showPageSizeSelector={true}
              />
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Key Features:</h4>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                <li>Server-side pagination support</li>
                <li>Dynamic page size selection</li>
                <li>Column sorting</li>
                <li>Responsive design</li>
                <li>Custom cell renderers</li>
              </ul>
            </div>
          </div>
        )}

        {/* Virtualized List Example */}
        {activeExample === 'virtualized' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Virtualized List</h3>
              <p className="text-sm text-gray-400 mb-4">
                Efficiently render 10,000+ items with infinite scroll
              </p>
              
              <VirtualizedList
                items={listItems}
                height={400}
                itemHeight={80}
                renderItem={(item, index, style) => (
                  <div style={style} className="px-4 py-2 border-b border-gray-700 hover:bg-gray-800/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-gray-400">{item.description}</p>
                      </div>
                      <span className="text-sm text-gray-500">#{index + 1}</span>
                    </div>
                  </div>
                )}
                onLoadMore={handleLoadMore}
                hasMore={hasMore}
                threshold={10}
                overscan={5}
                className="bg-gray-900 rounded-lg border border-gray-700"
              />
              
              <div className="text-sm text-gray-400 mt-2">
                Loaded {listItems.length} of {listData.length} items
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Key Features:</h4>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                <li>Virtual scrolling for performance</li>
                <li>Infinite scroll with lazy loading</li>
                <li>Fixed or variable item heights</li>
                <li>Customizable overscan for smooth scrolling</li>
                <li>Only renders visible items</li>
              </ul>
            </div>
          </div>
        )}

        {/* Infinite Chat Example */}
        {activeExample === 'chat' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Infinite Scroll Chat</h3>
              <p className="text-sm text-gray-400 mb-4">
                Bidirectional infinite scroll for chat interfaces
              </p>
              
              <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                <InfiniteScrollChat
                  messages={messages}
                  height={400}
                  renderMessage={(message, style) => (
                    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-4 py-2`}>
                      <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  )}
                  autoScrollToBottom={true}
                />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium mb-2">Key Features:</h4>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                <li>Bidirectional infinite scroll</li>
                <li>Auto-scroll to bottom for new messages</li>
                <li>Variable message heights</li>
                <li>Smooth scrolling behavior</li>
                <li>Memory efficient for long conversations</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Usage Examples */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Implementation Guide</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-medium mb-2">1. usePagination Hook</h3>
            <pre className="bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
{`import { usePagination } from '@/hooks/usePagination';

const [state, actions] = usePagination({
  initialPage: 1,
  initialPageSize: 20
});

// Access state
console.log(state.currentPage, state.totalPages);

// Use actions
actions.nextPage();
actions.setPageSize(50);`}
            </pre>
          </div>

          <div>
            <h3 className="font-medium mb-2">2. Server-side Pagination</h3>
            <pre className="bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
{`import { getPaginatedData } from '@/lib/supabase/pagination';

const result = await getPaginatedData('table_name', {
  page: 1,
  pageSize: 20,
  sortBy: 'created_at',
  sortDirection: 'desc',
  filters: { status: 'active' }
});`}
            </pre>
          </div>

          <div>
            <h3 className="font-medium mb-2">3. Virtualized Lists</h3>
            <pre className="bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto">
{`<VirtualizedList
  items={data}
  height={600}
  itemHeight={80}
  renderItem={(item, index, style) => (
    <div style={style}>
      {/* Your item content */}
    </div>
  )}
  onLoadMore={handleLoadMore}
  hasMore={hasMore}
/>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}