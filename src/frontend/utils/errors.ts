// ==============================================
// User-Friendly Error Messages
// ==============================================
// Never show raw API errors, JSON, or stack traces to users.

const ERROR_MAP: [RegExp, string][] = [
  [/429.*quota|exceeded.*quota|rate.?limit/i, 'Our AI is temporarily busy. Please wait a minute and try again.'],
  [/401.*unauthorized|invalid.*token|unrecognized login/i, 'Shopify connection expired. Please reinstall the app from your Shopify admin.'],
  [/403.*forbidden|not subscribed/i, 'This feature requires an API subscription. Contact support for help.'],
  [/500.*internal/i, 'Something went wrong on our end. Please try again in a moment.'],
  [/504.*timeout|timed? ?out/i, 'The request took too long. Please try again with fewer items.'],
  [/GEMINI_API_KEY|OPENAI_API_KEY|API.*not.*set/i, 'AI service is not configured. Please contact support.'],
  [/no.*product.*source|no.*provider/i, 'Product search is temporarily unavailable. Please try again later.'],
  [/network|fetch|ECONNREFUSED|ENOTFOUND/i, 'Network connection issue. Please check your internet and try again.'],
  [/prisma|database|unique constraint/i, 'A database error occurred. Please try again.'],
  [/JSON.*parse|unexpected token/i, 'Received an unexpected response. Please try again.'],
];

export function friendlyError(rawError: string): string {
  if (!rawError) return 'Something went wrong. Please try again.';

  for (const [pattern, friendly] of ERROR_MAP) {
    if (pattern.test(rawError)) return friendly;
  }

  // If it contains JSON or technical jargon, replace entirely
  if (rawError.includes('{') || rawError.includes('Error:') || rawError.length > 150) {
    return 'Something went wrong. Please try again in a moment.';
  }

  // Otherwise show the message but cap length
  return rawError.slice(0, 120);
}
