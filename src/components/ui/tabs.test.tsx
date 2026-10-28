import { useEffect, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

afterEach(cleanup)
test('visited panels retain drafts, inactive panels stay hidden, and unvisited panels stay lazy', () => {
  const mount = vi.fn()
  function Form() {
    const [value, setValue] = useState('')
    useEffect(() => { mount() }, [])
    return <input aria-label="draft" value={value} onChange={e => setValue(e.target.value)} />
  }
  render(<Tabs keepMounted defaultValue="a">
    <TabsList><TabsTrigger value="a">A</TabsTrigger><TabsTrigger value="b">B</TabsTrigger></TabsList>
    <TabsContent value="a">First</TabsContent><TabsContent value="b"><Form /></TabsContent>
  </Tabs>)
  expect(mount).not.toHaveBeenCalled()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'B' }), { button: 0, ctrlKey: false })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'keep this' } })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'A' }), { button: 0, ctrlKey: false })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByDisplayValue('keep this').closest('[role="tabpanel"]')).toHaveAttribute('hidden')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'B' }), { button: 0, ctrlKey: false })
  expect(screen.getByRole('textbox')).toHaveValue('keep this')
  expect(mount).toHaveBeenCalledTimes(1)
})
