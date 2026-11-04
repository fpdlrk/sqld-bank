/**
 * 파일 내려받기·읽기 (T7-3, T7-4 백업에서도 쓴다)
 * 서버 없이 브라우저 안에서 처리한다: 내려받기는 Blob 주소를 만든 링크를 눌러서, 읽기는 File.text()로.
 */

/** 객체를 JSON 파일로 내려받는다 */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 내려받기가 시작된 뒤 주소를 정리
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 고른 파일의 글자 내용 */
export function readFileText(file: File): Promise<string> {
  // 오래된 브라우저 대비: File.text()가 없으면 FileReader
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
