import DeskLayout from "@/components/layout/DeskLayout";
import { IncidentReviewProvider } from "@/lib/incident-review-context";
import { SceneProvider } from "@/lib/scene/SceneProvider";

export default function DeskRouteLayout({ children }) {
  return (
    <SceneProvider>
      <IncidentReviewProvider>
        <DeskLayout>{children}</DeskLayout>
      </IncidentReviewProvider>
    </SceneProvider>
  );
}
