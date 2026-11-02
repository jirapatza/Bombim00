import { Buffer } from 'node:buffer';

export class GitHubStorageError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = 'GITHUB_STORAGE_ERROR') {
    super(message);
    this.name = 'GitHubStorageError';
    this.status = status;
    this.code = code;
  }
}

type StorageOptions = {
  repo?: string;
  branch?: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

function resolveRepository(options: StorageOptions) {
  const repo = options.repo || process.env.GITHUB_REPOSITORY || 'jirapatza/Bombim00';
  const branch = options.branch || process.env.GITHUB_DATA_BRANCH || 'runtime-live';
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new GitHubStorageError('GITHUB_REPOSITORY must use owner/repository format.', 500, 'INVALID_REPOSITORY');
  }
  return { repo, branch };
}

function githubHeaders(token?: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Bombim00-Render/1.0',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function safePath(filePath: string) {
  if (!/^(config\/settings\.json|data\/all_lotteries\.json|lottery_previous_results\.json|status\/status\.json|status\/self_healing_history\.json)$/.test(filePath)) {
    throw new GitHubStorageError('The requested repository data path is not allowed.', 400, 'INVALID_DATA_PATH');
  }
  return filePath.split('/').map(encodeURIComponent).join('/');
}

async function responseError(response: Response, action: string) {
  const detail = (await response.text().catch(() => '')).slice(0, 500);
  if (response.status === 409 || response.status === 422) {
    return new GitHubStorageError(`GitHub rejected the ${action} because the file changed concurrently. Reload the latest data and try again.`, 409, 'GITHUB_WRITE_CONFLICT');
  }
  return new GitHubStorageError(`GitHub ${action} failed (HTTP ${response.status}). ${detail}`.trim(), response.status >= 400 && response.status < 600 ? response.status : 502);
}

export function assertNoSecretFields(value: unknown) {
  const forbiddenFragments = ['token', 'password', 'secret', 'apikey', 'authorization', 'privatekey', 'credential'];
  const visit = (item: unknown, depth: number) => {
    if (depth > 20) throw new GitHubStorageError('Settings structure is too deeply nested.', 400, 'INVALID_SETTINGS');
    if (Array.isArray(item)) {
      for (const child of item) visit(child, depth + 1);
      return;
    }
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (forbiddenFragments.some((fragment) => normalized.includes(fragment))) {
        const isEmpty = child === '' || child === null || child === undefined;
        if (!isEmpty) {
          throw new GitHubStorageError(`Sensitive field "${key}" cannot be stored in the public GitHub repository. Configure it as a Render secret instead.`, 400, 'SECRET_FIELD_NOT_ALLOWED');
        }
      }
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
}

export async function readGitHubJson<T>(
  filePath: string,
  options: StorageOptions = {},
): Promise<T> {
  const { repo, branch } = resolveRepository(options);
  const encodedPath = safePath(filePath);
  const fetchImpl = options.fetchImpl || fetch;
  const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${encodedPath}?v=${Date.now()}`;
  const response = await fetchImpl(url, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw await responseError(response, 'read');
  try {
    return await response.json() as T;
  } catch {
    throw new GitHubStorageError(`The repository file ${filePath} contains invalid JSON.`, 502, 'INVALID_REPOSITORY_JSON');
  }
}

export async function commitGitHubJson(
  filePath: string,
  value: unknown,
  message: string,
  options: StorageOptions = {},
): Promise<string> {
  const token = options.token || process.env.GITHUB_TOKEN || '';
  if (!token) {
    throw new GitHubStorageError('Persistent writes are disabled. Add GITHUB_TOKEN to the Render service environment.', 503, 'GITHUB_TOKEN_MISSING');
  }

  const { repo, branch } = resolveRepository(options);
  const encodedPath = safePath(filePath);
  const fetchImpl = options.fetchImpl || fetch;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${encodedPath}`;
  const headers = githubHeaders(token);
  const currentResponse = await fetchImpl(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!currentResponse.ok) throw await responseError(currentResponse, 'read-before-write');
  const currentFile = await currentResponse.json() as { sha?: string };
  if (!currentFile.sha) {
    throw new GitHubStorageError('GitHub did not return the current file version; refusing to overwrite repository data.', 502, 'MISSING_BLOB_SHA');
  }

  const content = Buffer.from(JSON.stringify(value, null, 2), 'utf8').toString('base64');
  const commitResponse = await fetchImpl(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message.includes('[skip render]') ? message : `${message} [skip render]`,
      content,
      branch,
      sha: currentFile.sha,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!commitResponse.ok) throw await responseError(commitResponse, 'write');
  const result = await commitResponse.json() as { commit?: { sha?: string } };
  if (!result.commit?.sha) {
    throw new GitHubStorageError('GitHub accepted the write but did not return a commit SHA.', 502, 'MISSING_COMMIT_SHA');
  }
  return result.commit.sha;
}
