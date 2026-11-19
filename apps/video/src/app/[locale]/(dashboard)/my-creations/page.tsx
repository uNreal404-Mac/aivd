import { CreationsLibrary } from "@/components/creation/creations-library";
import "@/styles/creations-tokens.css";

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
