import { detectProvider } from './providers.js';

/**
 * Parse any LLM response into a normalized format.
 */
export function parseResponse(raw, providerHint) {
  const provider = providerHint || detectProvider(raw);
  const parser = PARSERS[provider] || PARSERS.openai;
  const parsed = parser(raw);

  return {
    content: parsed.content || '',
    toolCalls: parsed.toolCalls || [],
    usage: parsed.usage || { input: 0, output: 0, total: 0, reasoning: 0 },
    finishReason: parsed.finishReason || 'unknown',
    thinking: parsed.thinking || null,
    provider,
    model: parsed.model || '',
    raw,
  };
}

/**
 * Extract and normalize tool calls from any provider.
 */
export function extractToolCalls(raw) {
  return parseResponse(raw).toolCalls;
}

/**
 * Extract and normalize token usage.
 */
export function extractUsage(raw) {
  return parseResponse(raw).usage;
}

// --- Provider-specific parsers ---

const PARSERS = {
  openai(raw) {
    const choice = raw.choices?.[0];
    if (!choice) return { content: '', toolCalls: [], usage: normalizeOpenAIUsage(raw.usage), finishReason: 'error' };

    const msg = choice.message || {};
    const toolCalls = (msg.tool_calls || []).map(tc => ({
      id: tc.id || '',
      name: tc.function?.name || '',
      arguments: parseArgs(tc.function?.arguments),
    }));

    return {
      content: msg.content || '',
      toolCalls,
      usage: normalizeOpenAIUsage(raw.usage),
      finishReason: mapFinishReason(choice.finish_reason),
      thinking: extractReasoningContent(raw),
      model: raw.model || '',
    };
  },

  anthropic(raw) {
    const content = raw.content || [];
    let textContent = '';
    let thinkingContent = '';
    const toolCalls = [];

    for (const block of content) {
      if (block.type === 'text') {
        textContent += block.text || '';
      } else if (block.type === 'thinking') {
        thinkingContent += block.thinking || '';
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id || '',
          name: block.name || '',
          arguments: block.input || {},
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      usage: {
        input: raw.usage?.input_tokens || 0,
        output: raw.usage?.output_tokens || 0,
        total: (raw.usage?.input_tokens || 0) + (raw.usage?.output_tokens || 0),
        reasoning: 0,
      },
      finishReason: mapFinishReason(raw.stop_reason),
      thinking: thinkingContent || null,
      model: raw.model || '',
    };
  },

  deepseek(raw) {
    // DeepSeek uses OpenAI-compatible format but may have reasoning_tokens
    const choice = raw.choices?.[0];
    if (!choice) return { content: '', toolCalls: [], usage: normalizeDeepSeekUsage(raw.usage), finishReason: 'error' };

    const msg = choice.message || {};
    const toolCalls = (msg.tool_calls || []).map(tc => ({
      id: tc.id || '',
      name: tc.function?.name || '',
      arguments: parseArgs(tc.function?.arguments),
    }));

    return {
      content: msg.content || '',
      toolCalls,
      usage: normalizeDeepSeekUsage(raw.usage),
      finishReason: mapFinishReason(choice.finish_reason),
      thinking: msg.reasoning_content || null,
      model: raw.model || '',
    };
  },

  mimo(raw) {
    // MiMo uses OpenAI-compatible format with reasoning_content
    const choice = raw.choices?.[0];
    if (!choice) return { content: '', toolCalls: [], usage: normalizeOpenAIUsage(raw.usage), finishReason: 'error' };

    const msg = choice.message || {};
    const toolCalls = (msg.tool_calls || []).map(tc => ({
      id: tc.id || '',
      name: tc.function?.name || '',
      arguments: parseArgs(tc.function?.arguments),
    }));

    // MiMo thinking models put reasoning in reasoning_content
    const thinking = msg.reasoning_content || null;
    const usage = normalizeOpenAIUsage(raw.usage);

    // Adjust reasoning count if thinking content exists
    if (thinking && usage.reasoning === 0) {
      // Estimate reasoning tokens (rough: 1 token per 4 chars)
      usage.reasoning = Math.round(thinking.length / 4);
    }

    return {
      content: msg.content || '',
      toolCalls,
      usage,
      finishReason: mapFinishReason(choice.finish_reason),
      thinking,
      model: raw.model || '',
    };
  },

  minimax(raw) {
    // MiniMax uses OpenAI-compatible format
    return PARSERS.openai(raw);
  },

  openrouter(raw) {
    // OpenRouter wraps different providers, try to detect inner format
    const choice = raw.choices?.[0];
    if (!choice) return PARSERS.openai(raw);

    const msg = choice.message || {};
    if (msg.reasoning_content) return PARSERS.deepseek(raw);
    return PARSERS.openai(raw);
  },
};

// --- Helpers ---

function parseArgs(args) {
  if (!args) return {};
  if (typeof args === 'object') return args;
  try {
    return JSON.parse(args);
  } catch {
    return {};
  }
}

function normalizeOpenAIUsage(usage) {
  if (!usage) return { input: 0, output: 0, total: 0, reasoning: 0 };
  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;
  const reasoning = usage.completion_tokens_details?.reasoning_tokens || 0;
  return { input, output, total: input + output, reasoning };
}

function normalizeDeepSeekUsage(usage) {
  if (!usage) return { input: 0, output: 0, total: 0, reasoning: 0 };
  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;
  const reasoning = usage.reasoning_tokens || 0;
  return { input, output, total: input + output, reasoning };
}

function extractReasoningContent(raw) {
  const choice = raw.choices?.[0];
  if (!choice) return null;
  const msg = choice.message || {};
  return msg.reasoning_content || msg.reasoning || null;
}

function mapFinishReason(reason) {
  if (!reason) return 'unknown';
  const map = {
    stop: 'stop',
    end_turn: 'stop',
    tool_calls: 'tool_calls',
    tool_use: 'tool_calls',
    length: 'length',
    max_tokens: 'length',
    content_filter: 'content_filter',
    error: 'error',
  };
  return map[reason] || reason;
}
