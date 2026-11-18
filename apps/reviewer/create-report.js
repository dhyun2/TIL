import { dayOf, fileExists, readNote } from '@til/journal/notes';
import { pullRequest, readEvent, topics } from './github.js';
import { reviewNote, signature } from './gemini.js';
import { conversation } from './conversation.js';
import { formatReport, cachedReviews } from './report.js';

// 태그의 기존 표기를 재사용한다. 병합 상태는 PR 리뷰 결과에 포함하지 않는다.
function normalizeReview({ source, finished_comment, ...review }, knownTags) {
  const spelling = new Map(knownTags.map(tag => [tag.toLowerCase(), tag]));
  const tags = review.tags.map(tag => spelling.get(tag.toLowerCase()) ?? tag);
  return { ...review, tags: [...new Set(tags)] };
}

function reviewLabels(entries) {
  const labels = new Set();
  for (const { result } of entries) {
    for (const category of result.categories) labels.add('분야/' + category);
    for (const tag of result.tags) labels.add('주제/' + tag);
  }
  return [...labels];
}

export async function createReport(event, pr = pullRequest(event.pull_request.number), generate = reviewNote) {
  const { head } = event.pull_request;
  const live = pr.details();
  if (live.head.sha !== head.sha) return;
  const files = pr.files();
  if (files.length !== live.changed_files) throw Error('PR 파일 목록을 완전히 읽지 못했어요.');
  const notes = files.filter(f => f.status !== 'removed' && dayOf(f.filename));
  const readChat = () => conversation(pr.comments(), event.repository.owner.id, []);
  const chat = readChat();
  if (chat.finish) return;
  const current = pr.issueLabels().filter(name => /^(분야|주제)\//.test(name));
  if (!notes.length && !chat.report && !current.length) return;

  const paths = new Map(files.map(f => [f.filename, f.status !== 'removed']));
  const renamed = new Set(files.map(f => f.previous_filename));
  const assetExists = path => paths.get(path) ?? (!renamed.has(path) && fileExists(path));
  const inputs = notes.map(file => ({
    file, ...readNote(file.filename, pr.readBlob(head, file.sha), assetExists),
  }));
  const existing = notes.length ? pr.repoLabels() : [];
  let known = topics(existing);
  const cache = cachedReviews(chat.report);
  const entries = [];
  for (const { file, author } of inputs) {
    const prior = cache[file.sha];
    const review = prior?.input === signature(author) ? prior : await generate(author, known);
    const result = normalizeReview(review, known);
    known = [...new Set([...known, ...result.tags])];
    entries.push({ file, result });
  }
  const body = formatReport(entries);
  if (body.length > 65536) throw Error('리뷰가 GitHub 댓글 길이 제한을 넘었어요.');
  if (pr.details().head.sha !== head.sha || (chat.report && readChat().finish)) return;
  pr.syncLabels(reviewLabels(entries), existing, current);
  if (!entries.length && chat.report) pr.remove(chat.report.id);
  else if (chat.report) pr.edit(chat.report.id, body);
  else if (entries.length) pr.comment(body);
}
if (import.meta.main) await createReport(readEvent());
