import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const RetainedTabsContext = React.createContext<{ value?: string; keepMounted: boolean }>({ keepMounted: false })

// Mount a panel on its first visit, then retain its form state without exposing
// inactive controls to keyboard navigation or accessibility tools.
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { keepMounted?: boolean }
>(({ value, defaultValue, onValueChange, keepMounted = false, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const activeValue = value ?? internalValue
  return (
    <RetainedTabsContext.Provider value={{ value: activeValue, keepMounted }}>
      <TabsPrimitive.Root {...props} ref={ref} value={activeValue} onValueChange={next => {
        setInternalValue(next)
        onValueChange?.(next)
      }} />
    </RetainedTabsContext.Provider>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "glass-tabs-list inline-flex h-10 items-center justify-center rounded-full bg-secondary p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "glass-tabs-trigger inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full px-4 text-xs font-medium ring-offset-background transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, value, forceMount, ...props }, ref) => {
  const context = React.useContext(RetainedTabsContext)
  const active = context.value === value
  const [visited, setVisited] = React.useState(active)
  React.useEffect(() => { if (active) setVisited(true) }, [active])
  const retained = context.keepMounted && (active || visited)
  return (
    <TabsPrimitive.Content
      {...props}
      ref={ref}
      value={value}
      forceMount={retained ? true : forceMount}
      hidden={context.keepMounted && !active ? true : props.hidden}
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        context.keepMounted && "retained-tab-panel",
        className
      )}
    />
  )
})
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
