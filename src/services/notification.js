/**
 * Notification Service
 * Handles all notification channels: Telegram, Webhook, App Push
 */

export function nowIso() { 
    return new Date().toISOString(); 
}

/**
 * Send notification via Telegram
 * @param {Object} config - Notification configuration
 * @param {string} text - Message text
 * @param {Function} fetchImpl - Fetch implementation (for testing)
 */
export async function sendTelegramNotification(config, text, fetchImpl = fetch) {
    const response = await fetchImpl(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: config.telegram.chatId,
            text
        })
    });
    if (!response.ok) {
        throw new Error(`Telegram request failed with ${response.status}`);
    }
    return { channel: 'telegram' };
}

/**
 * Send notification via Webhook
 * @param {Object} config - Notification configuration
 * @param {string} text - Message text
 * @param {Function} fetchImpl - Fetch implementation (for testing)
 */
export async function sendWebhookNotification(config, text, fetchImpl = fetch) {
    const response = await fetchImpl(config.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'MiPulse',
            type: 'test',
            message: text,
            timestamp: nowIso()
        })
    });
    if (!response.ok) {
        throw new Error(`Webhook request failed with ${response.status}`);
    }
    return { channel: 'webhook' };
}

/**
 * Send notification via App Push (PushPlus)
 * @param {Object} config - Notification configuration
 * @param {string} text - Message text
 * @param {Function} fetchImpl - Fetch implementation (for testing)
 */
export async function sendAppPushNotification(config, text, fetchImpl = fetch) {
    const response = await fetchImpl('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: config.pushplus.token,
            title: 'MiPulse Test Notification',
            content: text,
            template: 'txt'
        })
    });
    if (!response.ok) {
        throw new Error(`App push request failed with ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    if (payload && payload.code && payload.code !== 200) {
        throw new Error(payload.msg || 'App push rejected the request');
    }
    return { channel: 'appPush' };
}

/**
 * Send test notifications to all enabled channels
 * @param {Object} config - Notification configuration
 * @param {Function} fetchImpl - Fetch implementation (for testing)
 * @returns {Object} Results summary
 */
export async function sendTestNotifications(config, fetchImpl = fetch) {
    const text = `MiPulse test notification\nTime: ${nowIso()}`;
    const jobs = [];

    if (config.notificationEnabled && config.telegram?.enabled && config.telegram?.botToken && config.telegram?.chatId) {
        jobs.push(sendTelegramNotification(config, text, fetchImpl));
    }
    if (config.notificationEnabled && config.webhook?.enabled && config.webhook?.url) {
        jobs.push(sendWebhookNotification(config, text, fetchImpl));
    }
    if (config.notificationEnabled && config.pushplus?.enabled && config.pushplus?.token) {
        jobs.push(sendAppPushNotification(config, text, fetchImpl));
    }

    const results = await Promise.allSettled(jobs);
    const channels = results.map((result) => result.status === 'fulfilled'
        ? { ok: true, channel: result.value.channel }
        : { ok: false, error: result.reason?.message || 'Notification failed' });
    
    return {
        successCount: channels.filter((item) => item.ok).length,
        failureCount: channels.filter((item) => !item.ok).length,
        channels
    };
}
