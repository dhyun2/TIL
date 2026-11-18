import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { dayOf, readNote } from './read-note.js';

const entries = globSync('content/posts/*/title.md').sort().reverse().map(path => {
  const { meta } = readNote(path, readFileSync(path, 'utf8'));
  const day = dayOf(path);
  const title = meta.title.replace(/[&<>"'\[\]]/g, char => '&#' + char.charCodeAt(0) + ';').replaceAll('\n', ' ');
  return '- ' + day + ' · [' + title + '](https://dhyun2.github.io/TIL/notes/' + day + '/)';
});
const start = '<!-- study-index:start -->';
const end = '<!-- study-index:end -->';
const original = readFileSync('README.md', 'utf8');
if (original.split(start).length !== 2 || original.split(end).length !== 2 || original.indexOf(start) > original.indexOf(end)) {
  throw Error('README 목차 영역을 확인하세요.');
}
const index = entries.join('\n') || '아직 공부 기록이 없어요.';
const updated = original.slice(0, original.indexOf(start) + start.length) + '\n' + index + '\n' + original.slice(original.indexOf(end));
if (original !== updated) writeFileSync('README.md', updated);
