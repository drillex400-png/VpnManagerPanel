import { spawn, execSync, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, renameSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import net from 'net';
import AdmZip from 'adm-zip';
import { generateXrayConfig } from './config';
import type { ServerData, ClientData } from '../store';

const XRAY_BIN_DIR = process.env.XRAY_BIN_DIR || join(process.cwd(), '.xray-bin');
const XRAY_CFG_DIR = process.env.XRAY_CFG_DIR || join(process.cwd(), '.xray-configs');

// Track running xray processes: serverId -> ChildProcess
const processes = new Map<number, ChildProcess>();

// Log buffer per server: serverId -> string[]
const logBuffers = new Map<number, string[]>();
const MAX_LOG_LINES = 500;

// Ensure directories exist
mkdirSync(XRAY_BIN_DIR, { recursive: true });
mkdirSync(XRAY_CFG_DIR, { recursive: true });

function archSuffix(): string {
  if (process.arch === 'arm64') return 'arm64-v8a';
  return '64';
}

/**
 * Fetch available Xray-core versions from GitHub releases.
 */
export async function listAvailableVersions(): Promise<string[]> {
  const res = await fetch('https://api.github.com/repos/XTLS/Xray-core/releases?per_page=30', {
    headers: { 'User-Agent': 'vpn-panel' },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const releases = (await res.json()) as Array<{ tag_name: string }>;
  return releases.map((r) => r.tag_name);
}

/**
 * Check which versions are already downloaded locally.
 */
export function listLocalVersions(): string[] {
  if (!existsSync(XRAY_BIN_DIR)) return [];
  return readdirSync(XRAY_BIN_DIR)
    .filter((d: string) => existsSync(join(XRAY_BIN_DIR, d, 'xray')));
}

/**
 * Download and extract a specific Xray-core version.
 * Returns the path to the xray binary.
 */
export async function downloadVersion(version: string): Promise<string> {
  const versionDir = join(XRAY_BIN_DIR, version);
  const binaryPath = join(versionDir, 'xray');

  // Already downloaded
  if (existsSync(binaryPath)) {
    execSync(`chmod +x ${binaryPath}`);
    return binaryPath;
  }

  mkdirSync(versionDir, { recursive: true });

  const zipName = `Xray-linux-${archSuffix()}.zip`;
  const url = `https://github.com/XTLS/Xray-core/releases/download/${version}/${zipName}`;

  console.log(`[xray] Downloading ${version} from ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'vpn-panel' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

  const arrayBuf = await res.arrayBuffer();
  const zipPath = join(versionDir, 'xray.zip');
  writeFileSync(zipPath, Buffer.from(arrayBuf));

  // Extract using adm-zip (pure JS, no system deps)
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(versionDir, true);
  unlinkSync(zipPath);

  if (!existsSync(binaryPath)) {
    // The binary might be named differently — try to find it
    const files = readdirSync(versionDir);
    const xrayFile = files.find((f: string) => f === 'xray' || f === 'Xray');
    if (xrayFile && xrayFile !== 'xray') {
      renameSync(join(versionDir, xrayFile), binaryPath);
    }
  }

  if (!existsSync(binaryPath)) throw new Error('xray binary not found after extraction');
  execSync(`chmod +x ${binaryPath}`);

  console.log(`[xray] ${version} ready at ${binaryPath}`);
  return binaryPath;
}

/**
 * Get the binary path for a version (if downloaded).
 */
export function getBinaryPath(version: string): string | null {
  const path = join(XRAY_BIN_DIR, version, 'xray');
  return existsSync(path) ? path : null;
}

/**
 * Write xray config to file for a server.
 */
function writeConfig(server: ServerData, clients: ClientData[]): string {
  const configPath = join(XRAY_CFG_DIR, `server-${server.id}.json`);
  const config = generateXrayConfig(server, clients);
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Start an xray process for a server.
 */
export async function startServer(
  server: ServerData,
  clients: ClientData[],
): Promise<{ ok: boolean; error?: string }> {
  // Stop existing process
  stopServer(server.id);

  // Ensure binary is downloaded
  let binaryPath = getBinaryPath(server.xrayVersion);
  if (!binaryPath) {
    try {
      binaryPath = await downloadVersion(server.xrayVersion);
    } catch (e) {
      return { ok: false, error: `Failed to download xray ${server.xrayVersion}: ${(e as Error).message}` };
    }
  }

  // Write config
  const configPath = writeConfig(server, clients);

  // Start process
  return new Promise((resolve) => {
    const proc = spawn(binaryPath!, ['run', '-c', configPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let started = false;
    let errorMsg = '';
    let buf = logBuffers.get(server.id) || [];
    buf.push(`[${new Date().toISOString()}] Starting Xray ${server.xrayVersion} on port ${server.port}...`);
    logBuffers.set(server.id, buf);

    const appendLog = (text: string) => {
      const lines = text.split('\n').filter((l: string) => l.trim());
      let b = logBuffers.get(server.id);
      if (!b) { b = []; logBuffers.set(server.id, b); }
      b.push(...lines);
      if (b.length > MAX_LOG_LINES) b.splice(0, b.length - MAX_LOG_LINES);
    };

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      appendLog(text);
      if (!started && text.includes('started')) {
        started = true;
        processes.set(server.id, proc);
        resolve({ ok: true });
      }
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      errorMsg += text;
      appendLog(`[stderr] ${text}`);
    });

    proc.on('error', (err) => {
      if (!started) resolve({ ok: false, error: err.message });
      processes.delete(server.id);
    });

    proc.on('exit', (code) => {
      processes.delete(server.id);
      if (!started) {
        resolve({ ok: false, error: errorMsg || `xray exited with code ${code}` });
      }
    });

    // Give it 3 seconds to start
    setTimeout(() => {
      if (!started && !proc.killed) {
        // Check if process is still alive — assume it started successfully
        processes.set(server.id, proc);
        appendLog('[xray] Process assumed running (timeout-based start)');
        resolve({ ok: true });
      } else if (!started) {
        resolve({ ok: false, error: errorMsg || 'xray failed to start' });
      }
    }, 3000);
  });
}

/**
 * Stop an xray process for a server.
 */
export function stopServer(serverId: number): void {
  const proc = processes.get(serverId);
  if (proc) {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
    processes.delete(serverId);
  }
}

/**
 * Check if a server's xray process is running.
 */
export function isServerRunning(serverId: number): boolean {
  const proc = processes.get(serverId);
  if (!proc) return false;
  return !proc.killed && proc.exitCode === null;
}

/**
 * Query traffic stats from a running xray instance via the API.
 */
export function queryStats(apiPort: number): Record<string, { uplink: number; downlink: number }> {
  const binaryPath = findAnyBinary();
  if (!binaryPath) return {};

  try {
    const output = execSync(
      `${binaryPath} api statsquery --server=127.0.0.1:${apiPort}`,
      { timeout: 5000, encoding: 'utf-8' },
    );

    const parsed = JSON.parse(output);
    const stats: Record<string, { uplink: number; downlink: number }> = {};

    if (parsed.stat) {
      for (const s of parsed.stat) {
        // name format: "user>>>>email>>>traffic>>>uplink" or ">>>traffic>>>downlink"
        const match = s.name?.match(/user>>>>(.+?)>>>traffic>>>(uplink|downlink)/);
        if (match) {
          const email = match[1];
          const direction = match[2] as 'uplink' | 'downlink';
          if (!stats[email]) stats[email] = { uplink: 0, downlink: 0 };
          stats[email][direction] = Number(s.value) || 0;
        }
      }
    }

    return stats;
  } catch {
    return {};
  }
}

function findAnyBinary(): string | null {
  const versions = listLocalVersions();
  for (const v of versions) {
    const p = getBinaryPath(v);
    if (p) return p;
  }
  return null;
}

/**
 * Real TCP ping to a server's xray port.
 */
export function tcpPing(host: string, port: number, timeout = 3000): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port }, () => {
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

/**
 * Get accumulated logs for a server.
 */
export function getServerLogs(serverId: number): string[] {
  return logBuffers.get(serverId) || [];
}

/**
 * Clear logs for a server.
 */
export function clearServerLogs(serverId: number): void {
  logBuffers.set(serverId, []);
}

/**
 * Restart an xray process (stop + start).
 */
export async function restartServer(
  server: ServerData,
  clients: ClientData[],
): Promise<{ ok: boolean; error?: string }> {
  stopServer(server.id);
  return startServer(server, clients);
}

/**
 * Get the config file path for a server (for export).
 */
export function getServerConfigPath(server: ServerData, clients: ClientData[]): string {
  return writeConfig(server, clients);
}

/**
 * Reset all process tracking (called on backend restart).
 */
export function resetProcesses(): void {
  for (const [id, proc] of processes) {
    try {
      proc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  processes.clear();
  logBuffers.clear();
}
