import { categories } from '@til/journal/notes';

import { reviewerName, reviewFields } from '@til/journal/review';

// 기존 PR의 첫 리포트를 다시 찾는 식별자. 표시 이름이 바뀌어도 유지한다.
export const marker = '<!-- til:gemini-study-review -->';

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = value => value.replace(/[&<>"']/g, ch => entities[ch]);
export const plain = value => escape(value).replaceAll('@', '＠');
export const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g,
  entity => Object.keys(entities).find(ch => entities[ch] === entity));

export function reportComment(comments) {
  return comments.find(c => c.user.login === 'github-actions[bot]' && c.body.startsWith(marker));
}
export function cachedReviews(comment) {
  const encoded = comment?.body.match(/<!-- til:results ([A-Za-z0-9+/=]+) -->/)?.[1];
  return encoded ? JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) : {};
}
export function formatReport(entries) {
  const sections = entries.map(({ file, result }) => {
    const labels = result.categories.map(key => categories[key].label);
    return [
      '<h3><code>' + plain(file.filename) + '</code></h3>',
      '<p>분야 · ' + plain(labels.join(', ') || '미분류') + '<br>주제 · ' + plain(result.tags.join(', ') || '없음') + '</p>',
      ...Object.entries(reviewFields).map(([key, label]) => '<p><strong>' + label + '</strong> · ' + plain(result[key]) + '</p>'),
    ].join('\n\n');
  });
  const snapshot = Object.fromEntries(entries.map(({ file, result }) => [file.sha, result]));
  const encoded = Buffer.from(JSON.stringify(snapshot)).toString('base64');
  const help = '저장소 소유자는 이 PR의 Conversation에 `/답변 내용`으로 대화를 이어갈 수 있어요. 글이 여러 편이면 `/답변 YYYY-MM-DD 내용`을 쓰세요. `/마무리` 후 병합하면 대화가 해당 글에 저장돼요.';
  return [marker, '## ' + reviewerName + ' 학습 리뷰', ...sections, help, '<!-- til:results ' + encoded + ' -->'].join('\n\n');
}
