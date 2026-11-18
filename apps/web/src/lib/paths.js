export const repository = 'https://github.com/dhyun2/TIL';
export const sitePath = (path = '') => import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path;

// Markdown paths also work when reading the source file on GitHub.
const images = import.meta.glob('../../../../content/posts/*/assets/**/*', {
  eager: true, import: 'default', query: '?url',
});
export function imageUrl(path, day) {
  if (!path.startsWith('./assets/')) return path;
  const url = images['../../../../content/posts/' + day + '/' + path.slice(2)];
  if (!url) throw new Error('이미지 파일을 찾을 수 없습니다: ' + path);
  return url;
}
