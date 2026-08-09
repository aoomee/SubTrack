interface StatCardProps {
  title: string
  value: string | number
  description?: string
  divider?: boolean
  align?: "start" | "center"
}

export function StatCard({
  title,
  value,
  description,
  divider = false,
  align = "start",
}: StatCardProps) {
  const rowAlignment = align === "center" ? "justify-center text-center" : "justify-start text-left"

  return (
    <article
      className={`relative min-w-0 px-5 py-[22px] sm:px-6 ${
        divider
          ? "md:after:absolute md:after:inset-y-6 md:after:right-0 md:after:w-px md:after:bg-border/80 md:after:content-['']"
          : ""
      }`}
    >
      <div className="grid grid-rows-[20px_34px_16px] gap-y-2.5">
        <p className={`flex min-w-0 items-center truncate text-[13px] font-medium leading-none text-muted-foreground ${rowAlignment}`}>
          {title}
        </p>
        <div className={`flex min-w-0 items-center text-[30px] font-semibold leading-none tracking-[-0.045em] tabular-nums ${rowAlignment}`}>
          {value}
        </div>
        {description ? (
          <p className={`flex min-w-0 items-center truncate text-xs leading-none text-muted-foreground ${rowAlignment}`}>
            {description}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </article>
  )
}
