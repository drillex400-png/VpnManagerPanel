import { Client, type ConnectConfig } from 'ssh2';
import type { ServerData } from '../store';

export interface SshResult {
  stdout: string;
  stderr: string;
  code: number;
}

function connectConfig(server: ServerData): ConnectConfig {
  const cfg: ConnectConfig = {
    host: server.host,
    port: server.sshPort || 22,
    username: server.sshUser || 'root',
    readyTimeout: 15000,
    keepaliveInterval: 0,
  } as ConnectConfig;
  if (server.sshAuthType === 'password') {
    (cfg as any).password = server.sshPassword || '';
  } else {
    (cfg as any).privateKey = server.sshPrivateKey || '';
  }
  return cfg;
}

/** Выполнить команду на удалённой ноде по SSH. */
export function sshExec(server: ServerData, command: string, timeout = 30000): Promise<SshResult> {
  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;
    const done = (r: SshResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { conn.end(); } catch {}
      resolve(r);
    };
    const fail = (err: Error) => done({ stdout: '', stderr: err.message, code: -1 });
    const timer = setTimeout(() => fail(new Error('SSH: превышено время ожидания')), timeout);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) return fail(err);
        let stdout = '';
        let stderr = '';
        stream.on('data', (d: Buffer) => { stdout += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        stream.on('close', (code: number | null) => done({ stdout, stderr, code: code ?? 0 }));
      });
    });
    conn.on('error', (err: Error) => fail(err));
    try {
      conn.connect(connectConfig(server));
    } catch (e) {
      fail(e as Error);
    }
  });
}

/** Загрузить файл на удалённую ноду по SFTP. */
export function sshUpload(server: ServerData, remotePath: string, content: string, timeout = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { conn.end(); } catch {}
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), timeout);
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) return done(false);
        const stream = sftp.createWriteStream(remotePath);
        stream.on('error', () => done(false));
        stream.on('close', () => done(true));
        stream.end(Buffer.from(content));
      });
    });
    conn.on('error', () => done(false));
    try {
      conn.connect(connectConfig(server));
    } catch {
      done(false);
    }
  });
}

/** Проверить SSH-соединение с нодой. */
export async function testConnection(
  server: ServerData,
): Promise<{ ok: boolean; error?: string; info?: string }> {
  const res = await sshExec(server, 'uname -a', 20000);
  if (res.code < 0) return { ok: false, error: res.stderr || 'Не удалось подключиться по SSH' };
  return { ok: true, info: res.stdout.trim() };
}
