import { HowToCourseView } from "@/components/HowToCourseView";

type Props = { params: Promise<{ courseSlug: string }> };

export default async function HowToCoursePage({ params }: Props) {
  const { courseSlug } = await params;
  return <HowToCourseView courseSlug={courseSlug} />;
}
