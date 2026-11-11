import type { Metadata } from "next";

import { ReaderView } from "@/components/reader/reader-view";
import { demoArticle } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Sample edition",
  description:
    "Explore a complete Ghost Reader sample edition — reader view, typography controls, themes and a transparent access report.",
};

export default function DemoPage() {
  return <ReaderView result={demoArticle} sourceJobId="demo" backHref="/" backLabel="Home" demo />;
}
