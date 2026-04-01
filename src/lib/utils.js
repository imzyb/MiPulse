/**
 * 格式化字节速率为人类可读字符串
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatNetworkSpeed(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B/s';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化秒数为人类可读运行时间
 * @param {number} seconds 
 * @returns {string}
 */
export function formatUptime(seconds) {
    if (!seconds || seconds === 0) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (parts.length < 2 && s > 0) parts.push(`${s}s`);
    
    return parts.join(' ');
}

/**
 * 格式化字节为人类可读字符串 (容量)
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
