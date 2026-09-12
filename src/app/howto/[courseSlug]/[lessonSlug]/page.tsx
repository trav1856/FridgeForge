import { HowToLessonView } from "@/components/HowToLessonView";

type Props = {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
};

export default async function HowToLessonPage({ params }: Props) {
  const { courseSlug, lessonSlug } = await params;
  return (
    <HowToLessonView courseSlug={courseSlug} lessonSlug={lessonSlug} />
  );
}
