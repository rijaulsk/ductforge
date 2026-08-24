import type { Metadata } from "next";
import GuidePage from "@/components/GuidePage";
import { GUIDES, guideLanguages } from "@/lib/guide";

const guide = GUIDES.bn;

export const metadata: Metadata = {
  title: guide.metaTitle,
  description: guide.metaDescription,
  alternates: { canonical: guide.path, languages: guideLanguages() },
};

export default function Page() {
  return <GuidePage guide={guide} />;
}
