import { UgcDashboard } from "../../components/ugc-dashboard";
import { loadUgcReport } from "../../lib/load-ugc-report";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "UGC Queen | Webinar Intelligence" };
export default async function UgcPage() {
  try {
    return <UgcDashboard initial={await loadUgcReport()} error={null} />;
  } catch (e) {
    return (
      <UgcDashboard
        initial={null}
        error={e instanceof Error ? e.message : "UGC reporting is unavailable."}
      />
    );
  }
}
