import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,transform,opacity] duration-150 ease-[var(--ease-out)] outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/70 enabled:active:scale-[0.96] motion-reduce:transition-none motion-reduce:enabled:active:scale-100 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-secondary/70 text-foreground backdrop-blur-md hover:border-border-strong hover:bg-surface-elevated/85 aria-expanded:bg-surface-elevated",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-elevated aria-expanded:bg-secondary",
        ghost:
          "text-foreground/85 hover:bg-accent hover:text-foreground aria-expanded:bg-accent",
        destructive:
          "bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:border-destructive/50 focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-[min(var(--radius-md),12px)] px-3 text-[0.84rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[0.95rem]",
        icon: "size-11",
        "icon-xs": "size-9 rounded-[min(var(--radius-md),10px)]",
        "icon-sm": "size-10 rounded-[min(var(--radius-md),12px)]",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
