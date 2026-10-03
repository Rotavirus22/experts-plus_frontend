import { ComingSoon } from "@/components/coming-soon";

export default function Page() {
  return (
    <ComingSoon title="Audit log" phase={8} permission="audit.view">
      {"Who changed what, with before/after values."}
    </ComingSoon>
  );
}
