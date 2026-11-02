/// <reference types="node" />
// ↑ 이 테스트만 Node의 파일 시스템 API를 쓰므로 Node 타입을 여기서만 불러온다.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// T1-1: CLAUDE.md에 정한 폴더 구조가 실제로 있는지 확인한다.
// vitest는 프로젝트 루트에서 실행되므로 cwd가 곧 루트다.
const root = process.cwd()

const requiredDirs = [
  'src/app',
  'src/pages',
  'src/components',
  'src/domain',
  'src/engine',
  'src/storage',
  'src/data/questions',
  'src/styles',
  'tests',
  'docs',
]

describe('T1-1 폴더 구조', () => {
  it.each(requiredDirs)('%s 폴더가 존재한다', (dir) => {
    expect(existsSync(resolve(root, dir))).toBe(true)
  })
})
