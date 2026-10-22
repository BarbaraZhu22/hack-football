import DeskLayout from "@/components/layout/DeskLayout";
import { SceneProvider } from "@/lib/scene/SceneProvider";

export default function DeskRouteLayout({ children }) {
  return (
    <SceneProvider>
      <DeskLayout>{children}</DeskLayout>
    </SceneProvider>
  );
}
