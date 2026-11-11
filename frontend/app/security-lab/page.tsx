import type { Metadata } from "next";

import { SecurityLab } from "@/components/security-lab/security-lab";

export const metadata: Metadata = {
  title: "Security Lab",
  description:
    "Five local, defensive scenarios that show how Ghost Reader handles public content, access walls, metadata exposure and signed document delivery.",
};

export default function SecurityLabPage() {
  return <SecurityLab />;
}
