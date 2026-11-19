import { CreationsLibrary } from "@/components/creation/creations-library";
import "@/styles/creations-tokens.css";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return { title: locale === "zh" ? "我的作品" : "My creations" };
}

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function MyCreationsRoute({ params }: PageProps) {
  const { locale } = await params;
  return (
    <div className="db-page">
      <CreationsLibrary locale={locale} />
    </div>
  );
}
