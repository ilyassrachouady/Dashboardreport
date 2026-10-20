import { loadDataset } from "../lib/db";
import { refreshStaleSources } from "../lib/auto-sync";
import Dashboard from "../components/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Page() {
  // Keep external reporting data fresh without requiring a paid scheduler.
  // A completed sync within the last 15 minutes is reused; otherwise stale
  // sources refresh in parallel before the dashboard dataset is loaded.
  await refreshStaleSources();
  return <Dashboard {...await loadDataset()} />;
}
