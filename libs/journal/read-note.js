import { readFileSync, statSync } from 'node:fs';
import { parse } from 'yaml';

export const categories = parse(readFileSync(new URL('../../content/categories.yml', import.meta.url), 'utf8')).categories;
export const dayOf = path => /^content\/posts\/(\d{4}-\d{2}-\d{2})\/title\.md$/.exec(path)?.[1];
export function validDay(day) {
  const date = new Date(day + 'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(+date) && date.toISOString().startsWith(day);
}
export const fileExists = path => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
const hasText = value => typeof value === 'string' && Boolean(value.trim());
const supported = ['title', 'summary', 'level', 'categories', 'tags', 'learning', 'example', 'review_thread'];

function validateHeader(meta) {
  const errors = [];
  const unknown = Object.keys(meta).filter(key => !supported.includes(key));
  if (unknown.length) errors.push('지원하지 않는 YAML 항목: ' + unknown.join(', '));
  for (const key of ['title', 'summary']) {
    if (!hasText(meta[key])) errors.push(key + '에 비어 있지 않은 문장을 적으세요.');
  }
  if ('level' in meta && !['기초', '표준', '전문'].includes(meta.level)) {
    errors.push('level에는 기초, 표준, 전문 중 하나를 쓰세요.');
  }
  if ('categories' in meta && !(Array.isArray(meta.categories) && meta.categories.every(key => Object.hasOwn(categories, key)))) {
    errors.push('categories에는 등록된 분야 키의 배열을 쓰세요.');
  }
  if ('tags' in meta && !(Array.isArray(meta.tags) && meta.tags.length <= 3 && meta.tags.every(hasText))) {
    errors.push('tags에는 비어 있지 않은 주제를 세 개까지 쓰세요.');
  }
  if ('example' in meta && typeof meta.example !== 'boolean') errors.push('example에는 true 또는 false를 쓰세요.');
  if ('learning' in meta && !(Array.isArray(meta.learning) && meta.learning.every(entry =>
    entry && Object.hasOwn(categories, entry.category) && hasText(entry.topic)))) {
    errors.push('learning에는 등록된 category와 비어 있지 않은 topic이 필요합니다.');
  }
  if ('review_thread' in meta && !(Array.isArray(meta.review_thread) && meta.review_thread.every(turn =>
    turn && ['user', 'assistant'].includes(turn.role) && hasText(turn.text)))) {
    errors.push('review_thread에는 role(user 또는 assistant)과 text가 필요합니다.');
  }
  return errors;
}

function authorText(body) {
  const lines = body.split('\n');
  let fence;
  for (const [index, line] of lines.entries()) {
    if (fence) {
      const close = line.match(/^ {0,3}(`+|~+)[ \t]*$/)?.[1];
      if (close?.startsWith(fence)) fence = undefined;
    } else if (/^## AI 학습 리뷰[ \t]*$/.test(line)) {
      return lines.slice(0, index).join('\n').trim();
    } else {
      fence = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    }
  }
  return body.trim();
}

function coverIssue(body, assetExists, day) {
  const [first] = body.split(/\n[ \t]*\n/, 1);
  if (!first.startsWith('![')) return;
  const match = first.match(/^!\[([^\n]*)\]\((.+)\)$/);
  if (!match || !hasText(match[1])) return '표지는 첫 문단에 ![사진 설명](경로) 한 줄로 작성하세요.';
  const url = match[2].trim();
  if (/^https:\/\/[^/\s]+(?:\/[^\s]*)?$/.test(url)) return;
  const invalid = '표지 경로는 ./assets/ 아래 파일 또는 HTTPS 주소로 작성하세요.';
  if (!url.startsWith('./assets/')) return invalid;
  let path;
  try { path = 'content/posts/' + day + '/' + decodeURIComponent(url.slice(2)); } catch { return invalid; }
  if (path.includes('\0') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) return invalid;
  if (assetExists && !assetExists(path)) return '표지 파일을 찾을 수 없습니다: ' + path;
}

// Keep the original header and body so publishing a review preserves the author's formatting.
export function readNote(path, markdown, assetExists) {
  if (!validDay(dayOf(path))) throw Error('파일명은 실제 날짜의 content/posts/YYYY-MM-DD/title.md 형식이어야 합니다.');
  const parts = markdown.replaceAll('\r\n', '\n').match(/^(---[ \t]*\n)([\s\S]*?)^(---[ \t]*(?:\n|$))([\s\S]*)/m);
  if (!parts || parts.index !== 0) throw Error('파일 맨 위 YAML을 --- 두 줄로 감싸세요.');
  const [, opening, header, closing, body] = parts;
  const meta = parse(header);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw Error('상단 YAML에 title, summary를 작성하세요.');
  const errors = validateHeader(meta);
  const author = authorText(body);
  const cover = coverIssue(author, assetExists, dayOf(path));
  if (cover) errors.push(cover);
  const visible = author.replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(line =>
    !/^\s*!\[[^\]]*\]\([^\n]*\)\s*$/.test(line) && !/^ {0,3}(?:#{1,6}(?:\s|$)|`{3,}|~{3,})/.test(line));
  if (!visible.join('').trim()) errors.push('표지나 제목 아래에 공부한 내용을 한 줄 이상 적으세요.');
  if (errors.length) throw Error(errors.join('\n'));
  return { meta, author, opening, header, closing, body, newline: markdown.includes('\r\n') ? '\r\n' : '\n' };
}
