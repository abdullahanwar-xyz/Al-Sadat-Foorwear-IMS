import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}

export function GlassCard({ children, className, strong = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border shadow-lg",
        strong ? "glass-effect-strong" : "glass-effect",
        className
      )}
    >
      {children}
    </div>
  );
}
