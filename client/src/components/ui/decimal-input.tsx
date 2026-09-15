import * as React from "react"

import { Input } from "./input"

export interface DecimalInputProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "onChange"> {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

// For currency/decimal-style fields (rates, costs, balances, amounts, shoe
// half-sizes) - deliberately not type="number". Native number inputs don't
// support setSelectionRange, so when React's controlled-value reconciliation
// races the browser's own cursor tracking (keystrokes landing close
// together), digits can get inserted at the wrong position or duplicated -
// e.g. typing "3499.99" intermittently becoming "3499.99349999". type="text"
// with inputMode="decimal" sidesteps that whole class of bug while still
// bringing up the numeric keyboard on mobile; this filters keystrokes to
// digits and at most one decimal point so the value stays a valid decimal
// string for parseFloat at submit time.
const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        onChange(e)
      }
    }

    return (
      <Input
        type="text"
        inputMode="decimal"
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
DecimalInput.displayName = "DecimalInput"

export { DecimalInput }
