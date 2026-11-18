import { reviewerName } from '@til/journal/review';
import { decode, plain, reportComment } from './report.js';

// GitHub 댓글은 한 목록에 섞여 온다. 숨은 표식은 답변을 원래 질문과 글 날짜에 연결한다.
const answerMarker = /^<!-- til:answer (\d+) (\d{4}-\d{2}-\d{2}) -->\n\n/;
const hintMarker = /^<!-- til:hint (\d+) -->/;
const finishMarker = /^<!-- til:finished (\d+) -->/;
const replyCommand = /^\/답변(?:\s+(\d{4}-\d{2}-\d{2})(?=\s|$))?(?:\s+([\s\S]+))?$/;
const byId = (first, second) => first.id - second.id;
const signature = '**' + reviewerName + '**\n\n';

export function formatAnswer(request, text) {
  return `<!-- til:answer ${request.id} ${request.day} -->\n\n${signature}${plain(text)}`;
}

// 종료 확인이 게시된 뒤에는 작성자가 원래 명령을 수정해도 종료 시점을 기억한다.
function closure(ownerComments, botComments) {
  const confirmedIds = new Set();
  for (const comment of botComments) {
    const marker = comment.body.match(finishMarker);
    if (marker) confirmedIds.add(Number(marker[1]));
  }
  const ids = [...confirmedIds];
  for (const comment of ownerComments) {
    if (comment.body.trim() === '/마무리') ids.push(comment.id);
  }
  const finish = ids.length ? Math.min(...ids) : undefined;
  return { finish, confirmed: confirmedIds.has(finish) };
}

function indexResponses(botComments) {
  const answers = new Map();
  const hints = new Set();
  for (const { id, body } of botComments) {
    const match = body.match(answerMarker);
    if (match) {
      const requestId = Number(match[1]);
      if (answers.has(requestId)) continue;
      let text = body.slice(match[0].length);
      if (text.startsWith(signature)) text = text.slice(signature.length);
      answers.set(requestId, { id, day: match[2], text: decode(text) });
    }
    const hint = body.match(hintMarker);
    if (hint) hints.add(Number(hint[1]));
  }
  return { answers, hints };
}

export function conversation(comments, owner, days) {
  const report = reportComment(comments);
  if (!report || !owner) return { report, requests: [], finish: undefined, confirmed: false };
  const later = comments.filter(c => c.id > report.id).sort(byId);
  const author = later.filter(c => c.user.id === owner);
  const bots = later.filter(c => c.user.login === 'github-actions[bot]');
  const state = closure(author, bots);
  const beforeFinish = comment => !state.finish || comment.id < state.finish;
  const { answers, hints } = indexResponses(bots.filter(beforeFinish));
  const requests = [];
  for (const { id, body } of author.filter(beforeFinish)) {
    const command = body.trim().match(replyCommand);
    if (!command) continue;
    const answer = answers.get(id);
    const day = answer?.day ?? command[1] ?? (days.length === 1 ? days[0] : undefined);
    requests.push({ id, day, text: command[2]?.trim() ?? '', hinted: hints.has(id), answer });
  }
  return { report, requests, ...state };
}

export function messages(chat, day, before = Infinity) {
  const turns = [];
  for (const request of chat.requests) {
    if (request.day !== day || !request.text || request.hinted || request.id >= before) continue;
    turns.push({ id: request.id, role: 'user', text: request.text });
    const answer = request.answer;
    if (answer && answer.id < before) {
      turns.push({ id: answer.id, role: 'assistant', text: answer.text });
    }
  }
  return turns.sort(byId).map(({ role, text }) => ({ role, text }));
}
