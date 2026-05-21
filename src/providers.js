/**
 * Provider detection patterns.
 */
export const PROVIDER_PATTERNS = {
  anthropic: {
    detect: (raw) => !!raw.content && Array.isArray(raw.content) && !raw.choices,
    signature: 'Has content[] array without choices[]',
  },
  deepseek: {
    detect: (raw) => {
      const msg = raw.choices?.[0]?.message;
      return !!msg?.reasoning_content && raw.model?.includes('deepseek');
    },
    signature: 'reasoning_content + deepseek model name',
  },
  mimo: {
    detect: (raw) => {
      const msg = raw.choices?.[0]?.message;
      return !!msg?.reasoning_content && (raw.model?.includes('mimo') || raw.model?.includes('xiaomi'));
    },
    signature: 'reasoning_content + mimo/xiaomi model name',
  },
  openai: {
    detect: (raw) => !!raw.choices && !!raw.choices[0]?.message,
    signature: 'Has choices[] with message',
  },
};

/**
 * Auto-detect provider from response shape.
 */
export function detectProvider(raw) {
  // Check specific providers first (more specific patterns)
  for (const [name, pattern] of Object.entries(PROVIDER_PATTERNS)) {
    if (name === 'openai') continue; // OpenAI is the fallback
    if (pattern.detect(raw)) return name;
  }

  // Fallback to OpenAI-compatible
  if (PROVIDER_PATTERNS.openai.detect(raw)) return 'openai';

  return 'unknown';
}
