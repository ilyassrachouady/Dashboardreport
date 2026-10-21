"use client";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

export function MetricHelp({ label = "Metric details", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="metric-help" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label={label} title={label}><Info size={14} aria-hidden="true" /></summary>
      <div className="metric-help-content">{children}</div>
    </details>
  );
}
