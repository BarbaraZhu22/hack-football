import { cn } from "@/lib/utils";

export function FootballIcon({
  size = 15,
  missed = false,
  className,
  role,
  "aria-label": ariaLabel,
  title,
  ...props
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("shrink-0", className)}
      role={role}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel || role ? undefined : true}
      title={title}
      {...props}
    >
      <circle cx="12" cy="12" r="9.4" fill="var(--card)" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.4 15.42 10.89 14.12 14.91H9.88L8.58 10.89Z" fill="currentColor" />
      <path d="M8.9 4.6h6.2l-1.5 2.5h-3.2Zm-4.8 4.6v5.2l2.4-1.2v-2.8Zm15.8 0v5.2l-2.4-1.2v-2.8ZM9.9 19.4h4.2L13.3 17h-2.6Z" fill="currentColor" opacity="0.8" />
      {missed ? (
        <path d="M3.6 3.6 20.4 20.4" stroke="var(--destructive)" strokeWidth="2.4" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
