import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  onClear?: () => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, icon, onClear, value, onChange, ...props }, ref) => {
    const hasValue = typeof value === "string" && value.length > 0

    const handleClear = () => {
      if (onClear) {
        onClear()
        return
      }
      if (onChange) {
        const syntheticEvent = {
          target: { value: "" },
          currentTarget: { value: "" },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }
    }

    return (
      <div className="relative w-full">
        {icon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
            {icon}
          </div>
        )}
        <input
          value={value}
          onChange={onChange}
          className={cn(
            "flex h-10 w-full rounded-2xl border border-input bg-muted/50 px-3 py-2 text-base transition-[border-color,box-shadow,background-color] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            icon && "pl-10",
            hasValue && "pr-9",
            className
          )}
          ref={ref}
          {...props}
        />
        {hasValue && (onClear || onChange) && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
