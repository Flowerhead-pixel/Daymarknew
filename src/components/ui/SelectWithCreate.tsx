import { useState } from 'react'
import { Button } from './Button'

export interface Option {
  value: string
  label: string
}

/** A dropdown with a "+ New…" entry that creates the item on the spot. */
export function SelectWithCreate({
  value,
  onChange,
  options,
  onCreate,
  noneLabel,
  createLabel,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  onCreate: (name: string) => Promise<string>
  noneLabel?: string
  createLabel: string
  placeholder: string
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    try {
      onChange(await onCreate(n))
      setCreating(false)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  if (creating) {
    return (
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1"
          autoFocus
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button variant="primary" small disabled={!name.trim() || busy} onClick={add}>
          Add
        </Button>
        <Button
          variant="ghost"
          small
          onClick={() => {
            setCreating(false)
            setName('')
          }}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <select
      className="w-full"
      value={value}
      onChange={(e) => (e.target.value === '__new__' ? setCreating(true) : onChange(e.target.value))}
    >
      {noneLabel !== undefined && <option value="">{noneLabel}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      <option value="__new__">{createLabel}</option>
    </select>
  )
}
