import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function readEvent() {
  return JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
}

export function github(path, { method = 'GET', data, paginate = false } = {}) {
  const args = ['api', '--method', method, path];
  if (paginate) args.push('--paginate', '--slurp');
  if (data) args.push('--input', '-');
  const output = execFileSync('gh', args, {
    encoding: 'utf8', input: JSON.stringify(data), maxBuffer: 64 * 1024 * 1024,
  }).trim();
  if (!output) return;
  const result = JSON.parse(output);
  return paginate ? result.flat() : result;
}

export function pullRequest(number, api = github) {
  const repo = 'repos/' + process.env.GITHUB_REPOSITORY;
  const pull = repo + '/pulls/' + number;
  const issue = repo + '/issues/' + number;
  const list = path => api(path + '?per_page=100', { paginate: true });
  return {
    details: () => api(pull),
    files: () => list(pull + '/files'),
    comments: () => list(issue + '/comments'),
    repoLabels: () => list(repo + '/labels').map(label => label.name),
    issueLabels: () => list(issue + '/labels').map(label => label.name),
    comment: body => api(issue + '/comments', { method: 'POST', data: { body } }),
    edit: (id, body) => api(repo + '/issues/comments/' + id, { method: 'PATCH', data: { body } }),
    remove: id => api(repo + '/issues/comments/' + id, { method: 'DELETE' }),
    readBlob(head, sha) {
      const blob = api('repos/' + head.repo.full_name + '/git/blobs/' + sha);
      return Buffer.from(blob.content, 'base64').toString('utf8');
    },
    syncLabels(desired, existing, current) {
      for (const name of desired.filter(name => !existing.includes(name))) {
        const color = name.startsWith('분야/') ? 'D9E6FF' : 'ECE6FA';
        try {
          api(repo + '/labels', { method: 'POST', data: { name, color } });
        } catch {
          // Another PR may have just created this label.
          api(repo + '/labels/' + encodeURIComponent(name));
        }
      }
      if (desired.some(name => !current.includes(name))) {
        api(issue + '/labels', { method: 'POST', data: { labels: desired } });
      }
      for (const name of current.filter(name => !desired.includes(name))) {
        api(issue + '/labels/' + encodeURIComponent(name), { method: 'DELETE' });
      }
    },
  };
}

export const topics = labels => labels.filter(name => name.startsWith('주제/')).map(name => name.slice(3));
