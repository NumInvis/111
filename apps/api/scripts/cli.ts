import { readFileSync } from 'fs';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  if (json.data === undefined) {
    throw new Error('No data');
  }
  return json.data;
}

function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

async function create(prefPath?: string) {
  let preference;
  if (prefPath) {
    preference = JSON.parse(readFileSync(prefPath, 'utf-8'));
  }
  const data = await api<{ id: string; state: unknown }>('/game/sessions', {
    method: 'POST',
    body: JSON.stringify({ preference }),
  });
  printJson(data);
}

async function action(sessionId: string, action: string) {
  const data = await api<unknown>(`/game/sessions/${sessionId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  printJson(data);
}

async function get(sessionId: string) {
  const data = await api<unknown>(`/game/sessions/${sessionId}`);
  printJson(data);
}

async function config() {
  const data = await api<unknown>('/config');
  printJson(data);
}

async function models() {
  const data = await api<{ models: Array<{ id: string }>; count: number }>('/models');
  printJson(data);
}

function help() {
  console.log(`用法: tsx scripts/cli.ts <命令> [参数]

命令:
  create [pref.json]      创建新会话，可传入世界偏好 JSON
  action <sessionId> <action>  对会话执行行动
  get <sessionId>         获取会话状态
  config                  查看当前 AI 配置
  models                  拉取可用模型列表

环境变量:
  API_BASE                API 地址，默认 http://127.0.0.1:3000/api
`);
}

async function main() {
  const [, , cmd, ...args] = process.argv;

  switch (cmd) {
    case 'create':
      await create(args[0]);
      break;
    case 'action':
      if (args.length < 2) {
        console.error('需要 sessionId 和 action');
        process.exit(1);
      }
      await action(args[0], args.slice(1).join(' '));
      break;
    case 'get':
      if (!args[0]) {
        console.error('需要 sessionId');
        process.exit(1);
      }
      await get(args[0]);
      break;
    case 'config':
      await config();
      break;
    case 'models':
      await models();
      break;
    case 'help':
    case '-h':
    case '--help':
    default:
      help();
      if (!['help', '-h', '--help', undefined].includes(cmd)) {
        process.exit(1);
      }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
