/** Tavily /usage is 10 requests per 10 minutes; stay well under that. */
export const MCP_SNAPSHOT_TTL_MS = 6 * 60 * 1000;

/** Minimum gap between forced refreshes (still respects vendor rate limits). */
export const MCP_MIN_REFRESH_MS = 60 * 1000;

/** Published Tavily PAYGO rate. */
export const TAVILY_PAYGO_USD_PER_CREDIT = 0.008;

/** Exa Free Tier monthly credits. Remaining is estimated from this allotment. */
export const DEFAULT_EXA_ALLOTMENT_USD = 10;

export const DEFAULT_TAVILY_WARN_PCT = 80;
export const DEFAULT_EXA_WARN_USD = 2;

export const TAVILY_USAGE_URL = 'https://api.tavily.com/usage';
export const EXA_ADMIN_API_BASE = 'https://admin-api.exa.ai/team-management';
