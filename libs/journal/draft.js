export function draft(title = '') {
  return [
    '---',
    'title: ' + JSON.stringify(title),
    'summary: ""',
    'level: 표준 # 기초 / 표준 / 전문',
    '---',
    '',
    '## 배운 점',
    '',
  ].join('\n') + '\n';
}
