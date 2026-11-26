import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { reservePost } from './post-folders.js';
import { draft } from './draft.js';

async function readTitle() {
  if (process.argv.length > 2) return process.argv.slice(2).join(' ').trim();
  if (!process.stdin.isTTY) return '';
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await input.question('글 제목 › ')).trim();
  } finally {
    input.close();
  }
}

const title = await readTitle();
if (!title) {
  console.error('글 제목을 입력하세요. 예: pnpm new "브라우저 캐시 이해하기"');
  process.exitCode = 1;
} else {
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const dayFolder = new URL('../../content/posts/' + day + '/', import.meta.url);
  const number = reservePost(fileURLToPath(dayFolder));
  const folder = new URL(number + '/', dayFolder);
  await mkdir(new URL('assets/', folder));
  await writeFile(new URL('title.md', folder), draft(title), { flag: 'wx' });
  console.log('새 글을 만들었어요. 요약과 본문을 채워 주세요.');
  console.log('content/posts/' + day + '/' + number + '/title.md');
}
