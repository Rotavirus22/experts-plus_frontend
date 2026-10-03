import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon title="Reports" phase={7} permission="reports.view">
      {"Occupancy reports with every built-in field plus custom fields, exported to Excel."}
    </ComingSoon>
  );
}
