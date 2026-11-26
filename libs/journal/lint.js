import { globSync, lstatSync, readFileSync } from 'node:fs';
import { readReview } from './review-file.js';
import { fileExists, readNote } from './read-note.js';

const requested = process.argv.slice(2);
const paths = requested.length ? requested : globSync('content/posts/**/*').filter(path => !lstatSync(path).isDirectory() && !/^content\/posts\/[^/]+\/(?:[^/]+\/)?assets\//.test(path));
for (const path of paths) {
  try {
    if (!lstatSync(path).isFile()) throw Error('일반 파일을 지정하세요.');
    const source = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    if (path.endsWith('/review.md')) {
      if (!fileExists(path.replace(/review\.md$/, 'title.md'))) throw Error('같은 폴더에 title.md가 필요합니다.');
      readReview(source);
    } else {
      readNote(path.replace(/^\.\//, ''), source, fileExists);
    }
  } catch (error) {
    console.error(path + ' · ' + error.message);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('공부 기록 ' + paths.length + '개 규격 검사 통과');
