import type { Metadata } from "next";

import { LibraryPage } from "@/components/library/library-page";

export const metadata: Metadata = {
  description:
    "A private, local-first shelf for the editions you keep. Stored in your browser with export and import.",
};

export default function LibraryRoute() {
  return <LibraryPage />;
}
