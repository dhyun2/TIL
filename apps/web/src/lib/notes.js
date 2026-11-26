import { parseFrontmatter } from '@astrojs/markdown-remark';
import { categories as taxonomy } from '@til/journal/notes';
import { postIdOf } from '@til/journal/post-folders';
import { readReview } from '@til/journal/review-file';
import { processor } from './markdown';
import { sitePath } from './paths';

export const categories = Object.entries(taxonomy)
  .map(([key, { label }]) => ({ key, label }));
const sources = import.meta.glob(['../../../../content/posts/*/title.md', '../../../../content/posts/*/[0-9]*/title.md'], { eager: true, import: 'default', query: '?raw' });

const reviews = import.meta.glob(['../../../../content/posts/*/review.md', '../../../../content/posts/*/[0-9]*/review.md'], { eager: true, import: 'default', query: '?raw' });

async function readNote([path, source]) {
  const id = postIdOf(path.slice('../../../../'.length));
  const day = id?.split('/')[0];
  if (!day) throw new Error('기록 파일명을 확인하세요: ' + path);
  const { frontmatter: meta, content } = parseFrontmatter(source);
  const learning = meta.learning || [];
  const options = { frontmatter: { postId: id } };
  const rendered = await processor.render(content, options);
  const sourceReview = reviews[path.replace(/title\.md$/, 'review.md')];
  const review = sourceReview ? readReview(sourceReview) : null;
  const report = review ? (await processor.render(review.body, options)).code : '';
  return {
    ...meta, id, day, url: sitePath('notes/' + id + '/'), body: rendered.code, report, review_thread: review?.review_thread ?? [],
    cover: rendered.metadata.frontmatter.cover,
    areas: [...new Set(review?.categories ?? meta.categories ?? learning.map(entry => entry.category))],
    tags: review?.tags ?? meta.tags ?? learning.map(entry => entry.topic),
  };
}

export const notes = (await Promise.all(Object.entries(sources).map(readNote)))
  .sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));
export const months = Object.entries(Object.groupBy(notes, note => note.day.slice(0, 7)));
export const areas = categories.map(category => ({
  ...category, notes: notes.filter(note => note.areas.includes(category.key)),
}));
