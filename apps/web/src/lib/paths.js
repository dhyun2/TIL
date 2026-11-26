import { statSync } from 'node:fs';

export const repository = 'https://github.com/dhyun2/TIL';
export const sitePath = (path = '') => import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path;

// Markdown paths also work when reading the source file on GitHub.
const images = import.meta.env.DEV ? {} : import.meta.glob(['../../../../content/posts/*/assets/**/*', '../../../../content/posts/*/*/assets/**/*'], {
  eager: true, import: 'default', query: '?url',
});
export function imageUrl(path, postId) {
  if (!path.startsWith('./assets/')) return path;
  if (import.meta.env.DEV) {
    // A note can gain new images while the editor is already running.
    const assets = new URL('../../../../content/posts/' + postId + '/assets/', import.meta.url);
    const file = new URL(path.slice('./assets/'.length), assets);
    if (file.href.startsWith(assets.href) && statSync(file, { throwIfNoEntry: false })?.isFile()) {
      return '/@fs' + file.pathname;
    }
  } else {
    const url = images['../../../../content/posts/' + postId + '/' + path.slice(2)];
    if (url) return url;
  }
  throw new Error('이미지 파일을 찾을 수 없습니다: ' + path);
}
