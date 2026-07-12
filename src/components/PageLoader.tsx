import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-[40vh] grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        {label && <p className="text-sm">{label}</p>}
      </div>
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-24 ${className}`} />;
}

export function SkeletonRow() {
  return (
    <div className="space-y-2">
      <div className="skeleton h-3 w-1/3" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-card border border-border mb-4 shadow-soft">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
