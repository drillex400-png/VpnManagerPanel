import { store } from './store';
import type { ServerData, ClientData } from './store';

/** Отправить сообщение в Telegram через Bot API. */
async function sendTelegramMessage(text: string): Promise<boolean> {
  const { telegramBotToken, telegramChatId } = store.settings;
  if (!telegramBotToken || !telegramChatId) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text,
          parse_mode: 'HTML',
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Уведомление: статус ноды изменился. */
export async function notifyServerStatus(server: ServerData, oldStatus: string): Promise<void> {
  if (server.status === oldStatus) return;
  const icon = server.status === 'running' ? '🟢' : server.status === 'error' ? '🔴' : '⚫';
  const msg = server.status === 'running'
    ? `${icon} <b>Нода запущена</b>\n${server.name} (${server.host})`
    : server.status === 'error'
      ? `${icon} <b>Ошибка ноды</b>\n${server.name} (${server.host})\n${server.error || 'неизвестная ошибка'}`
      : `${icon} <b>Нода остановлена</b>\n${server.name} (${server.host})`;
  await sendTelegramMessage(msg);
}

/** Уведомление: клиент превысил лимит или истёк. */
export async function notifyClientLimit(client: ClientData, reason: 'expired' | 'limited'): Promise<void> {
  const icon = reason === 'expired' ? '⏰' : '📊';
  const msg = reason === 'expired'
    ? `${icon} <b>Подписка истекла</b>\nКлиент: ${client.name} (${client.email})`
    : `${icon} <b>Лимит трафика превышен</b>\nКлиент: ${client.name} (${client.email})\nИспользовано: ${(client.upload + client.download).toFixed(1)} / ${client.totalLimit} ГБ`;
  await sendTelegramMessage(msg);
}

/** Уведомление: новый клиент добавлен. */
export async function notifyClientAdded(client: ClientData): Promise<void> {
  const msg = `👤 <b>Новый клиент</b>\n${client.name} (${client.email})\nСервер: ${client.serverName}`;
  await sendTelegramMessage(msg);
}

/** Тестовое сообщение для проверки настроек. */
export async function sendTestNotification(): Promise<boolean> {
  return sendTelegramMessage('🧪 <b>Xray Панель</b>\nТестовое уведомление. Настройки Telegram работают корректно!');
}
