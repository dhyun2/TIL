import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { reviewFields } from '@til/journal/review';
import { readReview, writeReview } from '@til/journal/review-file';
import { postIdOf } from '@til/journal/post-folders';
import { readNote } from '@til/journal/notes';
import { github, pullRequest, readEvent, topics } from './github.js';
import { reviewNote } from './gemini.js';
import { conversation, messages } from './conversation.js';
import { cachedReviews, escape } from './report.js';

const treeEntry = (ref, path) => execFileSync('git', ['ls-tree', ref, '--', path], { encoding: 'utf8' }).trim();

function reportBody(review) {
    const lines = Object.entries(reviewFields).map(([key, label]) => {
      const text = escape(review[key]).replace(/[{}\[\]*_\\]/g, ch => '&#' + ch.charCodeAt(0) + ';').replace(/\s+/g, ' ').trim();
      return '- **' + label + '** — ' + text;
    });
  return lines.join('\n');
}

export async function publish(event, pr = pullRequest(event.pull_request.number), generate = reviewNote) {
  const merged = event.pull_request;
  const files = pr.files();
  if (files.length >= 3000 && files.length !== pr.details().changed_files) throw Error('PR 파일 목록이 잘렸습니다.');
  const notes = files.filter(file => file.status !== 'removed' && postIdOf(file.filename));
  if (!notes.length) return;
  const comments = pr.comments().filter(c => !merged.merged_at || c.created_at <= merged.merged_at);
  const postIds = notes.map(file => postIdOf(file.filename));
  const chat = conversation(comments, event.repository.owner.id, postIds);
  const cache = cachedReviews(chat.report);
  let knownTags;
  for (const { filename: path } of notes) {
    const entry = treeEntry(merged.merge_commit_sha, path);
    // 이후 PR에서 같은 글을 고쳤다면 이전 버전의 리뷰를 덮어쓰지 않는다.
    if (!entry || entry !== treeEntry('HEAD', path)) continue;
    const postId = postIdOf(path);
    const sha = entry.match(/^100(?:644|755) blob ([0-9a-f]+)\t/)?.[1];
    if (!sha) throw Error(path + ' · 일반 Markdown 파일이 필요합니다.');
    const output = path.replace(/title\.md$/, 'review.md');
    if (lstatSync(output, { throwIfNoEntry: false })?.isSymbolicLink()) throw Error('review.md는 일반 파일이어야 합니다.');
    const previous = existsSync(output) ? readReview(readFileSync(output, 'utf8')) : null;
    if (previous?.source === sha && previous?.merge === merged.merge_commit_sha) continue;

    const { author } = readNote(path, readFileSync(path, 'utf8'));
    const result = cache[sha] ?? await generate(author, knownTags ??= topics(pr.repoLabels()));
    const turns = chat.finish ? messages(chat, postId) : [];
    const meta = {
      source: sha, merge: merged.merge_commit_sha,
      categories: result.categories, tags: result.tags,
      review_thread: [...(previous?.review_thread ?? []), ...turns],
    };
    writeFileSync(output, writeReview(meta, previous?.body || reportBody(result)));

  }
}
// A single push can contain several merged PRs, or a direct commit with no review.
export async function publishPush(event, api = github, publishReview = publish) {
  if (!event.after) return;
  const range = /^0+$/.test(event.before) ? event.after : event.before + '..' + event.after;
  const log = (...args) => execFileSync('git', ['log', '--first-parent', '--reverse', '--format=%H', range, ...args],
    { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const touched = log('--', ':(glob)content/posts/*/title.md', ':(glob)content/posts/*/*/title.md');
  if (!touched.length) return;
  const pushed = new Set(log());
  const published = new Set();
  for (const sha of touched) {
    const pulls = api('repos/' + event.repository.full_name + '/commits/' + sha + '/pulls?per_page=100', { paginate: true });
    for (const pr of pulls) {
      if (!pr.merged_at || pr.base.ref !== 'main' || !pushed.has(pr.merge_commit_sha) || published.has(pr.number)) continue;
      await publishReview({ repository: event.repository, pull_request: pr });
      published.add(pr.number);
    }
  }
}

if (import.meta.main) await publishPush(readEvent());
