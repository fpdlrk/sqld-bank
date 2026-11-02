import { useParams } from 'react-router'
import { PagePlaceholder } from '../PagePlaceholder'

export function ResultPage() {
  const { sessionId } = useParams()

  return (
    <PagePlaceholder
      title="결과"
      description={`총점, 과목별 점수, 과락 여부, 문항별 정오를 확인합니다. (기록 ID: ${sessionId ?? '-'})`}
      plannedIn="T5-4"
    />
  )
}
