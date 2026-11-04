// 앱 아이콘 PNG 만들기 (T9-1) — 외부 라이브러리 없이 Node 내장 zlib로 PNG를 쓴다.
// 실행: node scripts/make-icons.mjs  → public/ 에 아이콘 파일 생성
// 그림: 파란 둥근 사각형 위에 흰색 데이터베이스(원통 3단) 모양.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [0x3a, 0x6e, 0xa5] // --color-primary
const FG = [0xff, 0xff, 0xff]

/** CRC32 (PNG 청크용) */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // 필터 없음
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 비트 깊이
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * 좌표(0~1)마다 색을 정하는 그림 함수
 * @param maskable 안드로이드 마스크용: 배경을 꽉 채우고 그림을 안전 영역(가운데 80%) 안에 작게
 */
function shade(u, v, maskable) {
  // 배경: 둥근 사각형 (maskable이면 전체)
  const r = 0.2
  const inRounded = (() => {
    if (maskable) return true
    const dx = Math.max(r - u, 0, u - (1 - r))
    const dy = Math.max(r - v, 0, v - (1 - r))
    return dx * dx + dy * dy <= r * r
  })()
  if (!inRounded) return null
  // 원통: 가운데 기준 크기
  const s = maskable ? 0.62 : 0.78
  const x = (u - 0.5) / s + 0.5
  const y = (v - 0.5) / s + 0.5
  const cx = 0.5
  const rx = 0.3
  const ry = 0.09
  const top = 0.24
  const bottom = 0.76
  const ell = (yc) => ((x - cx) / rx) ** 2 + ((y - yc) / ry) ** 2
  const inSide = Math.abs(x - cx) <= rx && y >= top && y <= bottom
  const inTop = ell(top) <= 1
  const inBottom = ell(bottom) <= 1
  if (!(inSide || inTop || inBottom)) return BG
  // 원통 안의 파란 선: 윗면 테두리와 가운데 두 줄 (3단으로 보이게)
  const line = 0.022 / s
  const onTopRim = Math.abs(Math.sqrt(ell(top)) - 1) * ry < line && y > top - ry
  const bands = [0.415, 0.585].some((yc) => {
    const e = ell(yc)
    return y > yc && Math.abs(Math.sqrt(e) - 1) * ry < line
  })
  return onTopRim || bands ? BG : FG
}

function render(size, maskable = false) {
  const rgba = Buffer.alloc(size * size * 4)
  const SS = 4 // 가장자리를 부드럽게 (4×4 샘플 평균)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, maskable)
          if (!c) continue
          r += c[0]
          g += c[1]
          b += c[2]
          a += 1
        }
      }
      const i = (py * size + px) * 4
      if (a > 0) {
        rgba[i] = Math.round(r / a)
        rgba[i + 1] = Math.round(g / a)
        rgba[i + 2] = Math.round(b / a)
      }
      rgba[i + 3] = Math.round((a / (SS * SS)) * 255)
    }
  }
  return png(size, rgba)
}

mkdirSync('public', { recursive: true })
writeFileSync('public/pwa-192x192.png', render(192))
writeFileSync('public/pwa-512x512.png', render(512))
writeFileSync('public/maskable-512x512.png', render(512, true))
writeFileSync('public/apple-touch-icon.png', render(180, true))
writeFileSync('public/favicon-32x32.png', render(32))
console.log('아이콘 5개를 public/에 만들었습니다.')
