import { notFound } from "next/navigation";
import { StruggleDetail } from "@/components/StruggleDetail";
import { getPublishedStruggleBySlug } from "@/lib/struggle-resources";

type Props = { params: Promise<{ slug: string }> };

export default async function StruggleDetailPage({ params }: Props) {
  const { slug } = await params;
  const resource = await getPublishedStruggleBySlug(slug);
  if (!resource) notFound();
  return <StruggleDetail resource={resource} />;
}
