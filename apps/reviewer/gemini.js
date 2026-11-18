import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { categories } from '@til/journal/notes';

const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const guide = readFileSync(new URL('../../docs/study-review.md', import.meta.url), 'utf8');
const conversationGuide = '학습 대화에서 작성자의 발언에 한국어로 직접 답한다. 글과 앞선 대화에서 근거를 짚고 필요할 때만 점검 질문을 하나 덧붙인다. 작성자의 발언이나 실험 결과를 만들어내지 않는다.';
const text = { type: 'string' };

export function signature(body) {
  return createHash('sha256').update([model, guide, JSON.stringify(categories), body].join('\0')).digest('hex');
}

async function generate(instructions, input, fields) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Error('GEMINI_API_KEY를 저장소 Actions secret에 등록해 주세요.');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const response = await fetch(url, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(100_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: {
        type: 'object', properties: fields, required: Object.keys(fields),
      } },
    }),
  });
  if (!response.ok) throw Error('Gemini HTTP ' + response.status + ' · 키, 모델, 할당량을 확인하세요.');
  const candidate = (await response.json()).candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw Error('Gemini 응답이 완료되지 않았습니다.');
  return JSON.parse(candidate.content.parts.filter(part => !part.thought).map(part => part.text).join(''));
}

export async function reviewNote(note, existing_tags) {
  const allowed = Object.keys(categories);
  const review = await generate(guide + '\n분야 목록\n' + JSON.stringify(categories), { note, existing_tags }, {
    categories: { type: 'array', items: { type: 'string', enum: allowed } },
    tags: { type: 'array', items: text, maxItems: 3 }, understood: text, follow_up: text, question: text,
  });
  for (const key of ['understood', 'follow_up', 'question']) {
    if (typeof review[key] !== 'string' || !review[key].trim()) throw Error('Gemini 리뷰 항목 누락 · ' + key);
  }
  review.categories = [...new Set(review.categories)].filter(area => allowed.includes(area));
  const tags = review.tags.map(tag => tag.trim()).filter(tag => /^[\p{L}\p{N}][\p{L}\p{N} .#+_-]{0,29}$/u.test(tag));
  return { ...review, tags: [...new Set(tags)].slice(0, 3), input: signature(note) };
}

export async function replyToNote(note, report, history, message) {
  const { reply } = await generate(conversationGuide, { note, report, history, message }, { reply: text });
  if (typeof reply !== 'string' || !reply.trim()) throw Error('Gemini 답변이 비었습니다.');
  return reply.trim();
}
