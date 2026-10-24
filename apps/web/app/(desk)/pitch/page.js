import { Suspense } from "react";

import PitchTab from "@/components/pitch/PitchTab";

export default function PitchPage() {
  return (
    <Suspense fallback={null}>
      <PitchTab />
    </Suspense>
  );
}
