import { parse, stringify } from 'yaml';

export function readReview(source) {
  const match = source.replaceAll('\r\n', '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw Error('review.md 상단에 리뷰 메타데이터가 필요합니다.');
  const meta = parse(match[1]);
  for (const key of ['categories', 'tags']) {
    if (!Array.isArray(meta?.[key]) || !meta[key].every(value => typeof value === 'string')) throw Error('review.md · ' + key + ' 배열을 확인하세요.');
  }
  const turns = meta.review_thread ?? [];
  if (!Array.isArray(turns) || !turns.every(turn => turn && ['user','assistant'].includes(turn.role) && typeof turn.text === 'string')) throw Error('review.md · 대화 형식을 확인하세요.');
  return { ...meta, review_thread: turns, body: match[2].trim() };
}

export function writeReview(meta, body) {
  return '---\n' + stringify(meta, { lineWidth: 0 }) + '---\n\n' + body.trim() + '\n';
}
