import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '../select'

// Mock Radix UI Portal to render in the same container for testing
jest.mock('@radix-ui/react-select', () => {
  const actual = jest.requireActual('@radix-ui/react-select')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

describe('Select', () => {
  const BasicSelect = ({ onValueChange = jest.fn() }: { onValueChange?: (value: string) => void }) => (
    <Select onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="orange">Orange</SelectItem>
          <SelectSeparator />
          <SelectItem value="grape">Grape</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )

  it('renders with placeholder', () => {
    render(<BasicSelect />)
    
    expect(screen.getByText('Select a fruit')).toBeInTheDocument()
  })

  it('opens dropdown when clicked', async () => {
    const user = userEvent.setup()
    render(<BasicSelect />)
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    expect(screen.getByText('Fruits')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.getByText('Orange')).toBeInTheDocument()
    expect(screen.getByText('Grape')).toBeInTheDocument()
  })

  it('selects an item when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    render(<BasicSelect onValueChange={handleChange} />)
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    const appleOption = screen.getByText('Apple')
    await user.click(appleOption)
    
    expect(handleChange).toHaveBeenCalledWith('apple')
  })

  it('displays selected value', async () => {
    const user = userEvent.setup()
    
    const ControlledSelect = () => {
      const [value, setValue] = React.useState('')
      return (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    
    render(<ControlledSelect />)
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    const appleOption = screen.getByText('Apple')
    await user.click(appleOption)
    
    expect(screen.getByRole('combobox')).toHaveTextContent('Apple')
  })

  it('handles disabled state', () => {
    render(
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Disabled select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="test">Test</SelectItem>
        </SelectContent>
      </Select>
    )
    
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-disabled', 'true')
    expect(trigger).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
  })

  it('renders with custom className on trigger', () => {
    render(
      <Select>
        <SelectTrigger className="custom-class">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="test">Test</SelectItem>
        </SelectContent>
      </Select>
    )
    
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveClass('custom-class')
  })

  it('shows chevron icon', () => {
    render(<BasicSelect />)
    
    const chevron = document.querySelector('.lucide-chevron-down')
    expect(chevron).toBeInTheDocument()
  })

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    render(<BasicSelect onValueChange={handleChange} />)
    
    const trigger = screen.getByRole('combobox')
    
    // Open with Enter key
    await user.click(trigger)
    await user.keyboard('{Enter}')
    
    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')
    
    // Should select the second item (banana)
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders separator correctly', async () => {
    const user = userEvent.setup()
    render(<BasicSelect />)
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    const separator = document.querySelector('.bg-muted')
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveClass('h-px')
  })

  it('shows check icon for selected item', async () => {
    const user = userEvent.setup()
    
    const ControlledSelect = () => {
      const [value, setValue] = React.useState('apple')
      return (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    
    render(<ControlledSelect />)
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    // Check icon should be visible for selected item
    const checkIcon = document.querySelector('.lucide-check')
    expect(checkIcon).toBeInTheDocument()
  })

  it('handles disabled items', async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    
    render(
      <Select onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="enabled">Enabled Option</SelectItem>
          <SelectItem value="disabled" disabled>Disabled Option</SelectItem>
        </SelectContent>
      </Select>
    )
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    const disabledOption = screen.getByText('Disabled Option')
    expect(disabledOption.parentElement).toHaveAttribute('aria-disabled', 'true')
    
    await user.click(disabledOption)
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('closes dropdown when item is selected', async () => {
    const user = userEvent.setup()
    render(<BasicSelect />)
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    expect(screen.getByText('Apple')).toBeInTheDocument()
    
    await user.click(screen.getByText('Apple'))
    
    // Dropdown should close
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })

  it('supports required attribute', () => {
    render(
      <Select required>
        <SelectTrigger>
          <SelectValue placeholder="Required select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="test">Test</SelectItem>
        </SelectContent>
      </Select>
    )
    
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-required', 'true')
  })

  it('handles groups with labels', async () => {
    const user = userEvent.setup()
    
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group 1</SelectLabel>
            <SelectItem value="1-1">Option 1-1</SelectItem>
            <SelectItem value="1-2">Option 1-2</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Group 2</SelectLabel>
            <SelectItem value="2-1">Option 2-1</SelectItem>
            <SelectItem value="2-2">Option 2-2</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )
    
    const trigger = screen.getByRole('combobox')
    await user.click(trigger)
    
    expect(screen.getByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 2')).toBeInTheDocument()
    expect(screen.getByText('Option 1-1')).toBeInTheDocument()
    expect(screen.getByText('Option 2-1')).toBeInTheDocument()
  })
})