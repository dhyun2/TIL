import { postIdOf } from '@til/journal/post-folders';
import { readNote } from '@til/journal/notes';
import { pullRequest, readEvent } from './github.js';
import { replyToNote } from './gemini.js';
import { cachedReviews } from './report.js';
import { conversation, messages, formatAnswer } from './conversation.js';

// 모델이 답하는 사이에 질문이 편집되거나 대화가 끝났으면 낡은 답변을 게시하지 않는다.
function stillAwaiting(chat, original) {
  if (chat.finish) return false;
  const latest = chat.requests.find(request => request.id === original.id);
  return latest && !latest.answer && !latest.hinted
    && latest.postId === original.postId && latest.text === original.text;
}

export async function reply(event, pr = pullRequest(event.issue.number), generate = replyToNote) {
  const owner = event.repository.owner.id;
  if (!owner || event.comment.user.id !== owner || !event.issue.pull_request) return;
  const initial = pr.details();
  if (initial.state !== 'open' || initial.base.ref !== 'main') return;
  const files = new Map(pr.files().filter(f => f.status !== 'removed' && postIdOf(f.filename)).map(f => [postIdOf(f.filename), f]));
  if (!files.size) return;
  const postIds = [...files.keys()];
  const readChat = () => conversation(pr.comments(), owner, postIds);
  for (;;) {
    const chat = readChat();
    if (!chat.report) return;
    if (chat.finish) {
      if (!chat.confirmed) pr.comment('<!-- til:finished ' + chat.finish + ' -->\n\n학습 대화를 마쳤어요. 병합하면 대화를 해당 글에 저장해요.');
      return;
    }
    const request = chat.requests.find(r => !r.answer && !r.hinted);
    if (!request) return;
    const file = files.get(request.postId);
    if (!file || !request.text) {
      pr.comment('<!-- til:hint ' + request.id + ' -->\n\n답변할 글과 내용을 함께 적어 주세요. 예: `/답변 ' + postIds[0] + ' 확인한 내용`');
      continue;
    }
    const report = cachedReviews(chat.report)[file.sha];
    if (!report) throw Error('최신 리뷰가 준비된 뒤 다시 실행하세요.');
    const { author } = readNote(file.filename, pr.readBlob(initial.head, file.sha));
    const answer = await generate(author, report, messages(chat, request.postId, request.id), request.text);
    const live = pr.details();
    if (live.state !== 'open' || live.head.sha !== initial.head.sha) return;
    if (!stillAwaiting(readChat(), request)) continue;
    pr.comment(formatAnswer(request, answer));
  }
}
if (import.meta.main) await reply(readEvent());
