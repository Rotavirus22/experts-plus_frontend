"use client"

import * as React from "react"

/**
 * Links a form field's <label> to its control. A field wrapper renders <FieldControl> around its label and
 * control; Input, Textarea and SelectTrigger pick the id up automatically, so `htmlFor` works without
 * threading ids through every form (screen readers announce the label, clicking it focuses the control).
 */
const FieldControlContext = React.createContext<string | undefined>(undefined)

export function FieldControl({ children }: { children: (id: string) => React.ReactNode }) {
  const id = React.useId()
  return <FieldControlContext.Provider value={id}>{children(id)}</FieldControlContext.Provider>
}

/** The id an Input/Textarea/SelectTrigger should use: its own, else the surrounding field's. */
export function useFieldControlId(own?: string): string | undefined {
  const fromField = React.useContext(FieldControlContext)
  return own ?? fromField
}
