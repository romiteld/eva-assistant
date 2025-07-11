import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../Sidebar'
import { useRouter, usePathname } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn()
}))

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

describe('Sidebar', () => {
  const mockPush = jest.fn()
  const mockOnClose = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
  })

  it('renders nothing when closed', () => {
    const { container } = render(<Sidebar isOpen={false} onClose={mockOnClose} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('renders sidebar when open', () => {
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    expect(screen.getByText('EVA Enterprise')).toBeInTheDocument()
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
  })

  it('displays all navigation items', () => {
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const expectedItems = [
      'Dashboard',
      'Voice Agent',
      'Lead Generation',
      'Content Studio',
      'Agent Orchestrator',
      'Outreach Campaigns',
      'Resume Parser',
      'Interview Center',
      'Recruiter Intel',
      'Task Management',
      'Firecrawl',
      'Candidates',
      'Messages',
      'Documents',
      'Settings'
    ]
    
    expectedItems.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  })

  it('highlights active navigation item', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard/voice')
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const voiceAgentButton = screen.getByText('Voice Agent').closest('button')
    expect(voiceAgentButton).toHaveClass('bg-purple-600/20', 'text-white', 'border-purple-500/30')
  })

  it('navigates to correct route on item click', async () => {
    const user = userEvent.setup()
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const voiceAgentButton = screen.getByText('Voice Agent')
    await user.click(voiceAgentButton)
    
    expect(mockPush).toHaveBeenCalledWith('/dashboard/voice')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('shows close button on mobile', () => {
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const closeButton = screen.getByRole('button', { name: '' })
    expect(closeButton).toBeInTheDocument()
    expect(closeButton).toHaveClass('lg:hidden')
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const closeButton = screen.getAllByRole('button')[0] // First button is the close button
    await user.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('displays system status', () => {
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    expect(screen.getByText('System Status')).toBeInTheDocument()
    expect(screen.getByText('All systems operational')).toBeInTheDocument()
  })

  it('renders EVA logo with gradient', () => {
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const logoContainer = screen.getByText('EVA Enterprise').parentElement?.previousSibling
    expect(logoContainer).toHaveClass('bg-gradient-to-br', 'from-purple-600', 'to-blue-600')
  })

  it('applies correct styling for inactive items', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard')
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const settingsButton = screen.getByText('Settings').closest('button')
    expect(settingsButton).toHaveClass('text-gray-400', 'hover:bg-white/5', 'hover:text-white')
  })

  it('handles navigation for all menu items', async () => {
    const user = userEvent.setup()
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const navigationPairs = [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Voice Agent', href: '/dashboard/voice' },
      { label: 'Lead Generation', href: '/dashboard/lead-generation' },
      { label: 'Content Studio', href: '/dashboard/content-studio' },
      { label: 'Settings', href: '/dashboard/settings' }
    ]
    
    for (const { label, href } of navigationPairs) {
      const button = screen.getByText(label)
      await user.click(button)
      
      expect(mockPush).toHaveBeenCalledWith(href)
      mockPush.mockClear()
    }
  })

  it('properly identifies active subroutes', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard/voice/settings')
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const voiceAgentButton = screen.getByText('Voice Agent').closest('button')
    expect(voiceAgentButton).toHaveClass('bg-purple-600/20')
  })

  it('does not highlight dashboard for subroutes', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard/voice')
    render(<Sidebar isOpen={true} onClose={mockOnClose} />)
    
    const dashboardButton = screen.getByText('Dashboard').closest('button')
    expect(dashboardButton).not.toHaveClass('bg-purple-600/20')
  })
})