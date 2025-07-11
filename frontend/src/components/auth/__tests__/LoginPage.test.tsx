import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../LoginPage'
import { authHelpers } from '@/lib/supabase/auth'

// Mock the auth helpers
jest.mock('@/lib/supabase/auth', () => ({
  authHelpers: {
    sendMagicLink: jest.fn()
  }
}))

describe('LoginPage', () => {
  const mockSendMagicLink = authHelpers.sendMagicLink as jest.MockedFunction<typeof authHelpers.sendMagicLink>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the login form correctly', () => {
    render(<LoginPage />)
    
    expect(screen.getByText('Welcome to EVA')).toBeInTheDocument()
    expect(screen.getByText('Your AI-powered Executive Virtual Assistant')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send magic link' })).toBeInTheDocument()
  })

  it('displays the email input field', () => {
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('required')
  })

  it('updates email value when user types', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    await user.type(emailInput, 'test@example.com')
    
    expect(emailInput).toHaveValue('test@example.com')
  })

  it('disables submit button when email is empty', () => {
    render(<LoginPage />)
    
    const submitButton = screen.getByRole('button', { name: 'Send magic link' })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when email is entered', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    const submitButton = screen.getByRole('button', { name: 'Send magic link' })
    
    await user.type(emailInput, 'test@example.com')
    expect(submitButton).not.toBeDisabled()
  })

  it('sends magic link on form submission', async () => {
    const user = userEvent.setup()
    mockSendMagicLink.mockResolvedValueOnce(undefined)
    
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    const submitButton = screen.getByRole('button', { name: 'Send magic link' })
    
    await user.type(emailInput, 'test@example.com')
    await user.click(submitButton)
    
    expect(mockSendMagicLink).toHaveBeenCalledWith('test@example.com')
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    mockSendMagicLink.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    await user.type(emailInput, 'test@example.com')
    
    const submitButton = screen.getByRole('button', { name: 'Send magic link' })
    await user.click(submitButton)
    
    expect(screen.getByText('Sending magic link...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
    
    await waitFor(() => {
      expect(screen.queryByText('Sending magic link...')).not.toBeInTheDocument()
    })
  })

  it('shows success message after sending magic link', async () => {
    const user = userEvent.setup()
    mockSendMagicLink.mockResolvedValueOnce(undefined)
    
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    await user.type(emailInput, 'test@example.com')
    
    const submitButton = screen.getByRole('button', { name: 'Send magic link' })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Check your email!')).toBeInTheDocument()
      expect(screen.getByText(/We've sent a magic link to/)).toBeInTheDocument()
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  it('shows error message when sending fails', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Failed to send email'
    mockSendMagicLink.mockRejectedValueOnce(new Error(errorMessage))
    
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    await user.type(emailInput, 'test@example.com')
    
    const submitButton = screen.getByRole('button', { name: 'Send magic link' })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('allows user to reset and use different email after success', async () => {
    const user = userEvent.setup()
    mockSendMagicLink.mockResolvedValueOnce(undefined)
    
    render(<LoginPage />)
    
    // Send magic link
    const emailInput = screen.getByRole('textbox', { name: /email address/i })
    await user.type(emailInput, 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Send magic link' }))
    
    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText('Check your email!')).toBeInTheDocument()
    })
    
    // Click "Use a different email"
    const resetButton = screen.getByText('Use a different email')
    await user.click(resetButton)
    
    // Should return to initial form state
    expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /email address/i })).toHaveValue('')
  })

  it('prevents form submission with invalid email', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    
    const emailInput = screen.getByRole('textbox', { name: /email address/i }) as HTMLInputElement
    const form = emailInput.closest('form')!
    
    // Try to submit with invalid email
    await user.type(emailInput, 'invalid-email')
    
    // Check HTML5 validation
    expect(emailInput.validity.valid).toBe(false)
  })

  it('renders terms and privacy links', () => {
    render(<LoginPage />)
    
    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })
})