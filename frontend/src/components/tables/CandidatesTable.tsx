import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Linkedin, Calendar, Tag } from 'lucide-react';
import PaginatedTable, { Column } from '../virtualized/PaginatedTable';
import { getPaginatedCandidates } from '@/lib/supabase/pagination';
import { useAuth } from '@/app/providers';

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  linkedin_url?: string;
  current_position?: string;
  current_company?: string;
  years_experience?: number;
  skills?: string[];
  status: string;
  source?: string;
  created_at: string;
}

export default function CandidatesTable() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch candidates
  useEffect(() => {
    if (!user) return;

    const fetchCandidates = async () => {
      setIsLoading(true);
      try {
        const result = await getPaginatedCandidates(user.id, {
          page: currentPage,
          pageSize,
          sortBy,
          sortDirection
        });

        setCandidates(result.data);
        setTotalItems(result.totalCount);
      } catch (error) {
        console.error('Error fetching candidates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandidates();
  }, [user, currentPage, pageSize, sortBy, sortDirection]);

  // Handle page change
  const handlePageChange = (page: number, newPageSize: number) => {
    setCurrentPage(page);
    setPageSize(newPageSize);
  };

  // Handle sort
  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortBy(column);
    setSortDirection(direction);
    setCurrentPage(1); // Reset to first page on sort
  };

  // Handle row click
  const handleRowClick = (candidate: Candidate) => {
    console.log('Selected candidate:', candidate);
    // Navigate to candidate detail page or open modal
  };

  // Status badge color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-900/50 text-blue-300',
      screening: 'bg-yellow-900/50 text-yellow-300',
      interviewing: 'bg-purple-900/50 text-purple-300',
      offered: 'bg-green-900/50 text-green-300',
      placed: 'bg-emerald-900/50 text-emerald-300',
      rejected: 'bg-red-900/50 text-red-300',
      on_hold: 'bg-gray-900/50 text-gray-300'
    };
    return colors[status] || 'bg-gray-900/50 text-gray-300';
  };

  // Define columns
  const columns: Column<Candidate>[] = [
    {
      key: 'name',
      header: 'Name',
      accessor: (candidate) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium">{candidate.first_name} {candidate.last_name}</p>
            <p className="text-xs text-gray-400">{candidate.current_position}</p>
          </div>
        </div>
      ),
      sortable: true,
      width: '250px'
    },
    {
      key: 'contact',
      header: 'Contact',
      accessor: (candidate) => (
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-sm">
            <Mail className="w-3 h-3 text-gray-400" />
            <span className="text-gray-300">{candidate.email}</span>
          </div>
          {candidate.phone && (
            <div className="flex items-center space-x-2 text-sm">
              <Phone className="w-3 h-3 text-gray-400" />
              <span className="text-gray-300">{candidate.phone}</span>
            </div>
          )}
        </div>
      ),
      width: '280px'
    },
    {
      key: 'current_company',
      header: 'Company',
      accessor: 'current_company',
      sortable: true,
      className: 'text-gray-300'
    },
    {
      key: 'years_experience',
      header: 'Experience',
      accessor: (candidate) => (
        <span className="text-gray-300">
          {candidate.years_experience ? `${candidate.years_experience} years` : '-'}
        </span>
      ),
      sortable: true,
      width: '120px'
    },
    {
      key: 'skills',
      header: 'Skills',
      accessor: (candidate) => (
        <div className="flex flex-wrap gap-1">
          {candidate.skills?.slice(0, 3).map((skill, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300"
            >
              {skill}
            </span>
          ))}
          {candidate.skills && candidate.skills.length > 3 && (
            <span className="text-xs text-gray-400">+{candidate.skills.length - 3}</span>
          )}
        </div>
      ),
      width: '200px'
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (candidate) => (
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(candidate.status)}`}>
          {candidate.status.replace('_', ' ')}
        </span>
      ),
      sortable: true,
      width: '120px'
    },
    {
      key: 'source',
      header: 'Source',
      accessor: (candidate) => (
        <div className="flex items-center space-x-1">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              <Linkedin className="w-4 h-4" />
            </a>
          )}
          <span className="text-sm text-gray-400">{candidate.source || 'Direct'}</span>
        </div>
      ),
      width: '120px'
    },
    {
      key: 'created_at',
      header: 'Added',
      accessor: (candidate) => (
        <div className="flex items-center space-x-1 text-sm text-gray-400">
          <Calendar className="w-3 h-3" />
          <span>{new Date(candidate.created_at).toLocaleDateString()}</span>
        </div>
      ),
      sortable: true,
      width: '140px'
    }
  ];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-xl font-semibold">Candidates</h2>
        <p className="text-sm text-gray-400 mt-1">
          Manage and track candidate pipeline
        </p>
      </div>
      
      <PaginatedTable
        data={candidates}
        columns={columns}
        totalItems={totalItems}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onSort={handleSort}
        isLoading={isLoading}
        emptyMessage="No candidates found"
        className="border-0"
        rowClassName="hover:bg-gray-800/30"
        onRowClick={handleRowClick}
        pageSizeOptions={[10, 20, 50, 100]}
        showPageSizeSelector={true}
      />
    </div>
  );
}