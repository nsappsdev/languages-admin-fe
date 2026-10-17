'use client';
import { useParams } from 'next/navigation';
import { VocabularyTermDetail } from '../../../../../components/vocabulary/VocabularyTermDetail';
export default function VocabularyDetailPage() {
  const { termId } = useParams<{ termId: string }>();
  return <VocabularyTermDetail key={termId} termId={termId} />;
}
