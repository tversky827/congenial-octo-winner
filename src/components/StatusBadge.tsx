const STYLES: Record<string, string> = {
  OPEN: "bg-emerald-50 text-emerald-700",
  FILLED: "bg-slate-100 text-slate-600",
  COMPLETED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-50 text-red-600",
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  WITHDRAWN: "bg-slate-100 text-slate-500",
};

const LABELS: Record<string, string> = {
  OPEN: "Open",
  FILLED: "Filled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  PENDING: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`chip ${STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
