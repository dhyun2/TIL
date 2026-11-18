import { dropPosition } from './drop-position.js';
import siteCss from '../styles/site.css?inline';

const editor = document.querySelector('.writer');
const day = document.querySelector('#write-date');
const source = document.querySelector('#source');
const output = document.querySelector('#rendered');
const status = document.querySelector('#write-status');
const save = document.querySelector('#save-note');
const prefix = 'til-writer:' + location.pathname + ':';
day.value = sessionStorage.getItem(prefix + 'day') ||
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
let revision;
let previewId = 0;
let timer;

async function api(action, body, binary = false) {
  const url = new URL(editor.dataset.api, location.href);
  url.search = new URLSearchParams({ action, day: day.value });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-til-editor': '1', 'content-type': binary ? 'application/octet-stream' : 'application/json' },
    body: binary ? body : JSON.stringify(body || {}),
  });
  if (!res.headers.get('content-type')?.includes('application/json')) throw Error('로컬 서버에 연결할 수 없어요.');
  const data = await res.json();
  if (!res.ok) throw Error(data.error);
  return data;
}

const escape = value => String(value ?? '').replace(/[&<>"]/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

function preview() {
  const id = ++previewId;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const data = await api('preview', { source: source.value });
      if (id !== previewId) return;
      output.srcdoc = `<!doctype html><html lang="ko"><meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https: data:; style-src 'unsafe-inline'">
        <style>${siteCss} body{padding:1.25rem;background:white}.note-header{margin:0 0 1rem}.note-header h1{font-size:2rem}</style>
        <header class="note-header"><time>${escape(day.value)}</time><h1>${escape(data.title)}</h1><p>${escape(data.summary)}</p>${data.level ? '<span class="note-level">난이도 · ' + escape(data.level) + '</span>' : ''}</header>
        <div class="note-body prose">${data.html}</div></html>`;
    } catch (err) {
      if (id === previewId) output.srcdoc = '<p>' + escape(err.message) + '</p>';
    }
  }, 150);
}

function changed() {
  sessionStorage.setItem(prefix + day.value, JSON.stringify({ source: source.value, revision }));
  status.textContent = '저장 전 변경사항이 있어요.';
  preview();
}

function busy(value) {
  day.disabled = source.disabled = save.disabled = value;
}

async function load() {
  busy(true);
  ++previewId;
  clearTimeout(timer);
  try {
    const data = await api('load');
    const draft = JSON.parse(sessionStorage.getItem(prefix + day.value));
    const local = draft && draft.source !== data.source ? draft : null;
    revision = local ? local.revision : data.revision;
    source.value = local ? local.source : data.source;
    sessionStorage.setItem(prefix + 'day', day.value);
    status.textContent = local ? '작성 중인 초안을 복원했어요.' : data.revision ? '저장된 기록을 열었어요.' : '새 기록이에요.';
    busy(false);
    preview();
  } catch (err) {
    day.disabled = false;
    status.textContent = err.message;
  }
}

save.onclick = async () => {
  busy(true);
  try {
    const data = await api('save', { source: source.value, revision });
    revision = data.revision;
    sessionStorage.removeItem(prefix + day.value);
    status.textContent = data.path + '에 저장했어요.';
  } catch (err) {
    status.textContent = err.message;
  } finally {
    busy(false);
  }
};

source.ondragover = event => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
};

source.ondrop = async event => {
  const images = Array.from(event.dataTransfer.files);
  if (!images.length) return;
  event.preventDefault();
  if (source.disabled) return;
  const pointer = dropPosition(source, event.clientX, event.clientY);
  const front = source.value.match(/^---[^\S\n]*\n[\s\S]*?\n---[^\S\n]*(?:\n|$)/);
  let at = Math.max(pointer, front?.[0].length || 0);
  busy(true);
  try {
    for (const image of images) {
      const data = await api('upload', image, true);
      const alt = image.name.replace(/\.[^.]+$/, '').replace(/[\[\]\\\r\n]/g, ' ').trim() || '사진';
      const markdown = '\n\n![' + alt + '](' + data.path + ')\n\n';
      source.setRangeText(markdown, at, at, 'end');
      at += markdown.length;
      changed();
    }
  } catch (err) {
    status.textContent = err.message;
  } finally {
    busy(false);
    source.focus();
  }
};
source.oninput = changed;
day.onchange = load;
load();
