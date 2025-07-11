import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input', () => {
  it('renders with default props', () => {
    render(<Input />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass(
      'flex',
      'h-10',
      'w-full',
      'rounded-md',
      'border',
      'border-input',
      'bg-background',
      'px-3',
      'py-2',
      'text-sm'
    )
  })

  it('accepts and displays value', async () => {
    const user = userEvent.setup()
    render(<Input />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'Hello world')
    
    expect(input).toHaveValue('Hello world')
  })

  it('handles controlled input correctly', () => {
    const ControlledInput = () => {
      const [value, setValue] = React.useState('initial')
      return (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )
    }
    
    render(<ControlledInput />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('initial')
    
    fireEvent.change(input, { target: { value: 'updated' } })
    expect(input).toHaveValue('updated')
  })

  it('supports different input types', () => {
    const { rerender } = render(<Input type="text" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text')
    
    rerender(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
    
    rerender(<Input type="password" />)
    const passwordInput = document.querySelector('input[type="password"]')
    expect(passwordInput).toBeInTheDocument()
    
    rerender(<Input type="number" />)
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
  })

  it('handles placeholder text', () => {
    render(<Input placeholder="Enter your name" />)
    
    const input = screen.getByPlaceholderText('Enter your name')
    expect(input).toBeInTheDocument()
  })

  it('respects disabled state', async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    
    render(<Input disabled onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50')
    
    await user.type(input, 'test')
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('custom-class')
    // Should also have default classes
    expect(input).toHaveClass('flex', 'h-10', 'w-full')
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>()
    
    render(<Input ref={ref} defaultValue="test" />)
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(ref.current?.value).toBe('test')
  })

  it('applies focus styles', () => {
    render(<Input />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-ring',
      'focus-visible:ring-offset-2'
    )
  })

  it('handles onChange event', async () => {
    const user = userEvent.setup()
    const handleChange = jest.fn()
    
    render(<Input onChange={handleChange} />)
    
    const input = screen.getByRole('textbox')
    await user.type(input, 'a')
    
    expect(handleChange).toHaveBeenCalled()
    expect(handleChange.mock.calls[0][0].target.value).toBe('a')
  })

  it('handles onFocus and onBlur events', async () => {
    const user = userEvent.setup()
    const handleFocus = jest.fn()
    const handleBlur = jest.fn()
    
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />)
    
    const input = screen.getByRole('textbox')
    
    await user.click(input)
    expect(handleFocus).toHaveBeenCalled()
    
    await user.tab()
    expect(handleBlur).toHaveBeenCalled()
  })

  it('supports HTML input attributes', () => {
    render(
      <Input
        name="username"
        id="username-input"
        required
        maxLength={20}
        autoComplete="username"
      />
    )
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('name', 'username')
    expect(input).toHaveAttribute('id', 'username-input')
    expect(input).toHaveAttribute('required')
    expect(input).toHaveAttribute('maxLength', '20')
    expect(input).toHaveAttribute('autoComplete', 'username')
  })

  it('handles file input styling', () => {
    render(<Input type="file" />)
    
    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass(
      'file:border-0',
      'file:bg-transparent',
      'file:text-sm',
      'file:font-medium'
    )
  })

  it('supports readonly attribute', () => {
    render(<Input readOnly value="readonly value" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveValue('readonly value')
  })

  it('handles form submission', () => {
    const handleSubmit = jest.fn((e) => e.preventDefault())
    
    render(
      <form onSubmit={handleSubmit}>
        <Input name="test" defaultValue="test value" />
        <button type="submit">Submit</button>
      </form>
    )
    
    const submitButton = screen.getByRole('button', { name: 'Submit' })
    fireEvent.click(submitButton)
    
    expect(handleSubmit).toHaveBeenCalled()
  })
})