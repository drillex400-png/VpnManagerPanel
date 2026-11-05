import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import net from 'net';
import AdmZip from 'adm-zip';
import { generateXrayConfig } from './config';
import { sshExec, sshUpload, testConnection as sshTest } from './ssh';
import type { ServerData, ClientData } from '../store';

// Каталог на удалённой ноде, где панель хранит бинарник Xray и конфиги серверов.
const REMOTE_DIR = '/opt/xray-panel';

// Локальный каталог для эталонных версий (используется как справочник).
const XRAY_BIN_DIR = process.env.XRAY_BIN_DIR || join(process.cwd(), '.xray-bin');
mkdirSync(XRAY_BIN_DIR, { recursive: true });

// Ноды, которые панель считает запущенными (PID живёт на самой ноде).
const runningIds = new Set<number>();

function serverDir(id: number): string {
  return `${REMOTE_DIR}/server-${id}`;
}

function binPath(version: string): string {
  return `${REMOTE_DIR}/xray-${version}/xray`;
}

// ── Проверка соединения ────────────────────────────────────────────────

export async function testConnection(server: ServerData): Promise<{ ok: boolean; error?: string; info?: string }> {
  return sshTest(server);
}

// ── Доступные версии Xray (GitHub) ─────────────────────────────────────

export async function listAvailableVersions(): Promise<string[]> {
  const res = await fetch('https://api.github.com/repos/XTLS/Xray-core/releases?per_page=30', {
    headers: { 'User-Agent': 'vpn-panel' },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const releases = (await res.json()) as Array<{ tag_name: string }>;
  return releases.map((r) => r.tag_name);
}

/** Версии, скачанные локально (справочник для выпадающего списка). */
export function listLocalVersions(): string[] {
  return readdirSync(XRAY_BIN_DIR).filter((d: string) => existsSync(join(XRAY_BIN_DIR, d, 'xray')));
}

/** Скачать версию Xray локально (эталон для списка). На ноду ставится при запуске. */
export async function downloadVersion(version: string): Promise<string> {
  const versionDir = join(XRAY_BIN_DIR, version);
  mkdirSync(versionDir, { recursive: true });
  const binaryPath = join(versionDir, 'xray');
  if (existsSync(binaryPath)) return binaryPath;

  const zipName = 'Xray-linux-64.zip';
  const url = `https://github.com/XTLS/Xray-core/releases/download/${version}/${zipName}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'vpn-panel' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  const zipPath = join(versionDir, 'xray.zip');
  writeFileSync(zipPath, Buffer.from(arrayBuf));
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(versionDir, true);
  unlinkSync(zipPath);
  if (existsSync(binaryPath)) execSync(`chmod +x ${binaryPath}`);
  return binaryPath;
}

// ── Управление Xray на ноде ────────────────────────────────────────────

/**
 * Запустить Xray на удалённой ноде: установка бинарника, загрузка конфига, старт.
 */
export async function startServer(
  server: ServerData,
  clients: ClientData[],
): Promise<{ ok: boolean; error?: string }> {
  // Сначала останавливаем предыдущий процесс на ноде.
  await stopServer(server);

  const dir = serverDir(server.id);
  const v = server.xrayVersion;
  const bp = binPath(v);

  // 1. Гарантируем наличие бинарника Xray нужной версии на ноде.
  const ensureBin =
    `mkdir -p ${REMOTE_DIR}/xray-${v} && cd ${REMOTE_DIR}/xray-${v} && ` +
    `if [ ! -x xray ]; then ` +
    `curl -sL -o x.zip "https://github.com/XTLS/Xray-core/releases/download/${v}/Xray-linux-64.zip" && ` +
    `(command -v unzip >/dev/null 2>&1 && unzip -o x.zip || python3 -c "import zipfile;zipfile.ZipFile('x.zip').extractall('.')") && ` +
    `rm -f x.zip && chmod +x xray; ` +
    `fi && [ -x "${bp}" ]`;
  const r1 = await sshExec(server, ensureBin, 180000);
  if (r1.code !== 0) {
    return {
      ok: false,
      error: `Не удалось установить Xray ${v} на ноду: ${r1.stderr || r1.stdout || 'нет ответа от ноды'}`,
    };
  }

  // 2. Загружаем сгенерированный конфиг на ноду.
  const config = JSON.stringify(generateXrayConfig(server, clients), null, 2);
  const uploaded = await sshUpload(server, `${dir}/config.json`, config, 30000);
  if (!uploaded) {
    return { ok: false, error: 'Не удалось загрузить конфигурацию на ноду по SFTP' };
  }

  // 3. Запускаем Xray и проверяем, что процесс жив.
  const startCmd =
    `mkdir -p ${dir} && cd ${dir} && ` +
    `nohup ${bp} run -c ${dir}/config.json > ${dir}/xray.log 2>&1 & ` +
    `echo $! > ${dir}/xray.pid && sleep 1.5 && ` +
    `(kill -0 $(cat ${dir}/xray.pid) 2>/dev/null && echo __OK__ || (echo __FAIL__; tail -n 40 ${dir}/xray.log))`;
  const r2 = await sshExec(server, startCmd, 30000);
  if (r2.stdout.includes('__OK__')) {
    runningIds.add(server.id);
    return { ok: true };
  }
  const detail = r2.stdout.includes('__FAIL__')
    ? r2.stdout.replace(/__FAIL__/, '').trim()
    : (r2.stderr || r2.stdout || 'Xray не запустился');
  return { ok: false, error: `Xray не запустился на ноде: ${detail}` };
}

/** Остановить Xray на ноде. */
export async function stopServer(server: ServerData): Promise<void> {
  const dir = serverDir(server.id);
  await sshExec(
    server,
    `if [ -f ${dir}/xray.pid ]; then kill $(cat ${dir}/xray.pid) 2>/dev/null; rm -f ${dir}/xray.pid; fi`,
    10000,
  );
  runningIds.delete(server.id);
}

/** Запущен ли сервер (состояние, известное панели). */
export function isServerRunning(serverId: number): boolean {
  return runningIds.has(serverId);
}

/** Проверить, жив ли процесс на ноде, и снять статус при падении. */
export async function verifyRunning(server: ServerData): Promise<boolean> {
  if (!runningIds.has(server.id)) return false;
  const dir = serverDir(server.id);
  const r = await sshExec(server, `kill -0 $(cat ${dir}/xray.pid 2>/dev/null) 2>/dev/null && echo alive`, 10000);
  if (!r.stdout.includes('alive')) {
    runningIds.delete(server.id);
    return false;
  }
  return true;
}

/** Перезапуск Xray на ноде. */
export async function restartServer(
  server: ServerData,
  clients: ClientData[],
): Promise<{ ok: boolean; error?: string }> {
  await stopServer(server);
  return startServer(server, clients);
}

/** Статистика трафика с API Xray на ноде. */
export async function queryStats(
  server: ServerData,
): Promise<Record<string, { uplink: number; downlink: number }>> {
  if (!runningIds.has(server.id)) return {};
  const bp = binPath(server.xrayVersion);
  const r = await sshExec(server, `${bp} api statsquery --server=127.0.0.1:${server.apiPort}`, 10000);
  if (r.code !== 0 || !r.stdout.trim()) return {};
  const stats: Record<string, { uplink: number; downlink: number }> = {};
  try {
    const parsed = JSON.parse(r.stdout);
    if (parsed.stat) {
      for (const s of parsed.stat) {
        const match = s.name?.match(/user>>>>(.+?)>>>traffic>>>(uplink|downlink)/);
        if (match) {
          const email = match[1];
          const direction = match[2] as 'uplink' | 'downlink';
          if (!stats[email]) stats[email] = { uplink: 0, downlink: 0 };
          stats[email][direction] = Number(s.value) || 0;
        }
      }
    }
  } catch {
    return {};
  }
  return stats;
}

/** Реальный TCP-пинг до порта Xray на ноде. */
export function tcpPing(host: string, port: number, timeout = 3000): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.connect({ host, port }, () => {
      socket.end();
      resolve(Date.now() - start);
    });
    socket.on('error', () => resolve(-1));
    socket.setTimeout(timeout, () => {
      socket.destroy();
      resolve(-1);
    });
  });
}

/** Логи Xray с ноды. */
export async function getServerLogs(server: ServerData): Promise<string[]> {
  const dir = serverDir(server.id);
  const r = await sshExec(server, `tail -n 200 ${dir}/xray.log 2>/dev/null`, 10000);
  if (!r.stdout) return [];
  return r.stdout.split('\n').filter((l: string) => l.trim());
}

/** Очистить логи на ноде. */
export async function clearServerLogs(server: ServerData): Promise<void> {
  await sshExec(server, `echo "" > ${serverDir(server.id)}/xray.log`, 10000);
}

/** Сгенерировать конфиг (для экспорта) — локально, без обращения к ноде. */
export function getServerConfig(server: ServerData, clients: ClientData[]): string {
  return JSON.stringify(generateXrayConfig(server, clients), null, 2);
}

/** Сбросить отслеживание процессов при перезапуске бэкенда. */
export function resetProcesses(): void {
  runningIds.clear();
}
