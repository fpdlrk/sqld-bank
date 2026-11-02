import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  DataTable,
  Modal,
  ProgressBar,
  Tabs,
  ThemeSwitch,
} from '../../components'
import styles from '../Page.module.css'

/**
 * 임시 컴포넌트 견본 화면 (T1-4) — 주소창에 #/dev 로 들어온다. 메뉴에는 없다.
 * 화면들이 어느 정도 완성되면 지운다.
 */
const SAMPLE_SQL = `-- 부서별 보너스 합계 (NULL은 집계에서 제외)
SELECT dept, COUNT(*) AS cnt, COUNT(bonus) AS bonus_cnt,
       NVL(SUM(bonus), 0) AS total
  FROM emp
 WHERE ename LIKE 'K%' OR ename = 'O''NEIL'
 GROUP BY dept
HAVING COUNT(*) >= 2
 ORDER BY total DESC NULLS LAST;`

const LONG_SQL = `SELECT e.empno, e.ename, e.job, e.mgr, e.hiredate, e.sal, e.comm, d.dname, d.loc, RANK() OVER (PARTITION BY e.deptno ORDER BY e.sal DESC) AS rnk FROM emp e LEFT OUTER JOIN dept d ON e.deptno = d.deptno;`

export function DevPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [progress, setProgress] = useState(3)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>컴포넌트 견본</h1>
        <p className={styles.desc}>개발 확인용 임시 화면입니다. 테마를 바꿔 가며 색을 확인하세요.</p>
        <ThemeSwitch />
      </header>

      <Card title="Button">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <Button>기본(primary)</Button>
          <Button variant="secondary">보조</Button>
          <Button variant="ghost">고스트</Button>
          <Button variant="danger">삭제</Button>
          <Button disabled>비활성</Button>
          <Button size="lg">큰 버튼</Button>
        </div>
        <Button block variant="secondary">
          폭 꽉 채우기
        </Button>
      </Card>

      <Card title="Badge" actions={<Badge tone="primary">S1-05</Badge>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <Badge>기본</Badge>
          <Badge tone="primary">2과목</Badge>
          <Badge tone="success">정답</Badge>
          <Badge tone="danger">오답</Badge>
          <Badge tone="warning">난이도 ★★★</Badge>
          <Badge tone="info">템플릿</Badge>
        </div>
      </Card>

      <Card title="ProgressBar">
        <ProgressBar label="진행" value={progress} max={10} />
        <ProgressBar label="1과목 정답률" value={72} tone="success" />
        <ProgressBar label="과락 위험" value={35} tone="danger" />
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={() => setProgress((p) => Math.max(0, p - 1))}>
            −1
          </Button>
          <Button variant="secondary" onClick={() => setProgress((p) => Math.min(10, p + 1))}>
            +1
          </Button>
        </div>
      </Card>

      <Card title="Modal">
        <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="시험을 제출할까요?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                취소
              </Button>
              <Button onClick={() => setModalOpen(false)}>제출</Button>
            </>
          }
        >
          <p>아직 풀지 않은 문항이 3개 있습니다. 제출하면 되돌릴 수 없습니다.</p>
        </Modal>
      </Card>

      <Card title="Tabs">
        <Tabs
          label="해설 보기"
          items={[
            { id: 'exp', label: '해설', content: <p>COUNT(*)는 행 수를, COUNT(컬럼)은 NULL이 아닌 값의 수를 셉니다.</p> },
            { id: 'sql', label: '실행 SQL', content: <CodeBlock code="SELECT COUNT(*), COUNT(bonus) FROM emp;" /> },
            { id: 'memo', label: '내 메모', content: <p>메모가 없습니다.</p> },
          ]}
        />
      </Card>

      <Card title="CodeBlock">
        <CodeBlock code={SAMPLE_SQL} caption="Oracle SQL" />
        <CodeBlock code={LONG_SQL} caption="긴 줄 — 박스 안에서만 가로 스크롤" />
      </Card>

      <Card title="DataTable">
        <DataTable
          name="EMP"
          columns={['EMPNO', 'ENAME', 'DEPT', 'BONUS']}
          rows={[
            [1, 'KING', 'A', 100],
            [2, 'KIM', 'A', null],
            [3, 'LEE', 'B', 50],
            [4, 'PARK', 'B', null],
            [5, 'CHOI', null, 30],
          ]}
        />
        <DataTable caption="실행 결과" columns={['DEPT', 'CNT', 'TOTAL']} rows={[['A', 2, 100], ['B', 2, 50]]} />
        <DataTable caption="실행 결과 (0행)" columns={['DEPT', 'CNT']} rows={[]} />
        <DataTable
          caption="칸이 많은 표 — 가로 스크롤"
          columns={['EMPNO', 'ENAME', 'JOB', 'MGR', 'HIREDATE', 'SAL', 'COMM', 'DEPTNO']}
          rows={[[7369, 'SMITH', 'CLERK', 7902, '1980-12-17', 800, null, 20]]}
        />
      </Card>
    </div>
  )
}
