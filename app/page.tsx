import { loadDataset } from "../lib/db";
import Dashboard from "../components/dashboard";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <Dashboard {...await loadDataset()} />;
}
