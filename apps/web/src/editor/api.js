import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { draft } from '@til/journal/draft';
import { readNote, fileExists, validDay } from '@til/journal/notes';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { processor } from '../lib/markdown';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export const prerender = false;
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => Response.json({ error: message }, { status });

function extension(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png';
  if (bytes.subarray(0, 3).toString('hex') === 'ffd8ff') return 'jpg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) return 'gif';
}

export async function POST({ request, url, clientAddress }) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientAddress) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      request.headers.get('origin') !== url.origin || request.headers.get('x-til-editor') !== '1') {
    return fail('로컬 주소에서 편집기를 열어 주세요.', 403);
  }
  const day = url.searchParams.get('day') || '';
  if (!validDay(day)) return fail('날짜를 확인해 주세요.');
  const relativePath = 'content/posts/' + day + '/title.md';
  const path = resolve(repoRoot, relativePath);
  const action = url.searchParams.get('action');

  if (action === 'upload') {
    const max = 10 * 1024 * 1024;
    if (Number(request.headers.get('content-length')) > max) return fail('이미지는 10MB까지 올릴 수 있어요.', 413);
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length > max) return fail('이미지는 10MB까지 올릴 수 있어요.', 413);
    const ext = extension(bytes);
    if (!ext) return fail('PNG, JPEG, WebP, GIF 파일을 선택해 주세요.');
    const dir = resolve(repoRoot, 'content/posts', day, 'assets');
    mkdirSync(dir, { recursive: true });
    const name = hash(bytes).slice(0, 24) + '.' + ext;
    const image = resolve(dir, name);
    if (!existsSync(image)) writeFileSync(image, bytes, { flag: 'wx' });
    return Response.json({ path: './assets/' + name });
  }

  if (action === 'load') {
    const saved = existsSync(path) ? readFileSync(path, 'utf8') : null;
    return Response.json({ source: saved ?? draft(), revision: saved === null ? null : hash(saved) });
  }
  const { source, revision } = await request.json();
  if (typeof source !== 'string') return fail('Markdown을 입력해 주세요.');
  if (action === 'preview') {
    try {
      const { frontmatter, content } = parseFrontmatter(source);
      const { code } = await processor.render(content, { frontmatter: { day } });
      return Response.json({ title: frontmatter.title, summary: frontmatter.summary, level: frontmatter.level,
        html: code });
    } catch {
      return fail('YAML과 이미지 경로를 확인해 주세요.');
    }
  }
  if (action !== 'save') return fail('알 수 없는 요청입니다.');
  try {
    readNote(relativePath, source, asset => fileExists(resolve(repoRoot, asset)));
  } catch (error) {
    return fail(error.message);
  }
  const savedRevision = existsSync(path) ? hash(readFileSync(path)) : null;
  if (revision !== savedRevision) return fail('파일이 다른 곳에서 변경됐어요. 작성 내용을 복사한 뒤 다시 열어 주세요.', 409);
  mkdirSync(resolve(repoRoot, 'content/posts', day), { recursive: true });
  const temporary = resolve(repoRoot, 'content/posts', day, '.' + randomUUID() + '.tmp');
  try {
    writeFileSync(temporary, source, { flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  return Response.json({ path: relativePath, revision: hash(source) });
}
