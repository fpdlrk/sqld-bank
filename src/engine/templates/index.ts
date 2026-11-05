/**
 * 템플릿 목록 (docs/04 §7) — 새 템플릿은 여기에 추가한다
 */
import type { QuestionTemplate } from '../../domain'
import { TP01 } from './tp01'
import { TP02 } from './tp02'
import { TP03 } from './tp03'
import { TP04 } from './tp04'
import { TP05 } from './tp05'
import { TP06 } from './tp06'
import { TP07 } from './tp07'
import { TP08 } from './tp08'
import { TP09 } from './tp09'
import { TP10 } from './tp10'
import { TP11 } from './tp11'
import { TP12 } from './tp12'
import { TP13 } from './tp13'
import { TP14 } from './tp14'
import { TP15 } from './tp15'
import { TP16 } from './tp16'
import { TP17 } from './tp17'
import { TP18 } from './tp18'

export const TEMPLATES: readonly QuestionTemplate[] = [
  TP01, TP02, TP03, TP04, TP05, TP06, TP07, TP08, TP09, TP10,
  TP11, TP12, TP13, TP14, TP15, TP16, TP17, TP18,
]

export function findTemplate(id: string): QuestionTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export { TP01, TP02, TP03, TP04, TP05, TP06, TP07, TP08, TP09, TP10, TP11, TP12, TP13, TP14, TP15, TP16, TP17, TP18 }
