import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The date alone identifies a legacy post. New posts have a numbered subfolder.
export const isPostNumber = value => /^(?:0[1-9]|[1-9]\d+)$/.test(value);
export function postIdOf(path) {
  const match = /^content\/posts\/(\d{4}-\d{2}-\d{2})(?:\/([^/]+))?\/title\.md$/.exec(path);
  if (match && (!match[2] || isPostNumber(match[2]))) return match[2] ? match[1] + '/' + match[2] : match[1];
}

export function postNumbers(dayFolder) {
  if (!existsSync(dayFolder)) return [];
  return readdirSync(dayFolder, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && isPostNumber(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}

export function reservePost(dayFolder) {
  mkdirSync(dayFolder, { recursive: true });
  let next = BigInt(postNumbers(dayFolder).at(-1) ?? 0) + 1n;
  for (;;) {
    const number = String(next).padStart(2, '0');
    try {
      mkdirSync(join(dayFolder, number));
      return number;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      next++;
    }
  }
}
