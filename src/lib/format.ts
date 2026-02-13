import { formatDistanceToNow, format } from 'date-fns';

/**
 * Format large token counts: 1234567 -> "1.23M", 12345 -> "12.3k", 999 -> "999"
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(2)}M`;
  }
  if (count >= 10_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(2)}k`;
  }
  return count.toLocaleString();
}

/**
 * Format cost in USD: 0 -> "$0.00", 0.0023 -> "$0.0023", 1.5 -> "$1.50"
 */
export function formatCost(cost: number, estimated: boolean = false): string {
  const prefix = estimated ? '~' : '';
  if (cost === 0) {
    return `${prefix}$0.00`;
  }
  if (cost < 0.01) {
    return `${prefix}$${cost.toFixed(4)}`;
  }
  return `${prefix}$${cost.toFixed(2)}`;
}

export function formatCostBreakdown(reported: number, estimated: number): string {
  return `${formatCost(reported)} reported / ${formatCost(estimated, true)} est`;
}

/**
 * Format duration in ms to human-readable:
 * 500 -> "500ms", 1234 -> "1.2s", 65000 -> "1m 5s",
 * 3700000 -> "1h 1m", 90000000 -> "1d 1h"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    if (seconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }
  if (ms < 86_400_000) {
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.round((ms % 3_600_000) / 60_000);
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.round((ms % 86_400_000) / 3_600_000);
  if (hours === 0) {
    return `${days}d`;
  }
  return `${days}d ${hours}h`;
}

/**
 * Format Unix epoch ms to relative time: "2 hours ago", "3 days ago"
 */
export function formatRelativeTime(epochMs: number): string {
  return formatDistanceToNow(new Date(epochMs), { addSuffix: true });
}

/**
 * Format Unix epoch ms to date string: "2025-01-15"
 */
export function formatDate(epochMs: number): string {
  return format(new Date(epochMs), 'yyyy-MM-dd');
}

/**
 * Format Unix epoch ms to datetime string: "2025-01-15 14:30"
 */
export function formatDateTime(epochMs: number): string {
  return format(new Date(epochMs), 'yyyy-MM-dd HH:mm');
}

/**
 * Format diff stats: "+123 / -45"
 */
export function formatDiff(additions: number, deletions: number): string {
  return `+${additions} / -${deletions}`;
}

/**
 * Format bytes to human-readable: 1234 -> "1.2 KB", 1234567 -> "1.2 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a percentage: 85.5 -> "85.5%"
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Truncate a session ID for display: "abc123def456..." -> "abc123d..."
 */
export function truncateId(id: string, length: number = 8): string {
  if (id.length <= length) return id;
  return `${id.slice(0, length)}...`;
}

/**
 * Extract project name from worktree path:
 * "/Users/foo/projects/my-app" -> "my-app"
 */
export function projectName(worktree: string): string {
  const parts = worktree.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? worktree;
}
