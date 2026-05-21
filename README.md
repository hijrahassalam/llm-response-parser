# 🔍 LLM Response Parser

**Normalize any LLM provider's response into a consistent format. One parser, every model.**

[![npm](https://img.shields.io/npm/v/llm-response-parser?color=blue)](https://www.npmjs.com/package/llm-response-parser)
[![license](https://img.shields.io/npm/l/llm-response-parser?color=green)](LICENSE)
[![node](https://img.shields.io/node/v/llm-response-parser)](package.json)
[![zero deps](https://img.shields.io/dependencies-0-brightgreen)](package.json)

A zero-dependency library for parsing, normalizing, and extracting data from LLM API responses across all major providers. Handles tool calls, thinking tokens, streaming, and provider quirks automatically.

---

## ⚠️ Real-World Pitfall

> **MiMo v2.5-pro silently swallowed 50,000 thinking tokens because my parser checked `message.content` instead of `reasoning_content`.**
>
> A production agent powered by MiMo was returning empty responses 30% of the time. No errors, no crashes. The model was spending all its tokens on internal reasoning, and my parser was looking in the wrong field. By the time I found the bug, the agent had wasted 2 million tokens on invisible thinking.
>
> MiMo, DeepSeek, Anthropic, and OpenAI all return the same data in completely different structures. This library normalizes all of them into one consistent format.

---

## ✨ Features

- **Universal Parser** — One function parses MiMo, OpenAI, Anthropic, DeepSeek, MiniMax, OpenRouter, and custom providers
- **MiMo Thinking Token Extraction** — Handles MiMo v2.5-pro reasoning_content field that other parsers miss
- **Tool Call Normalization** — Extracts tool_calls regardless of provider format (OpenAI message.tool_calls vs Anthropic content[] blocks)
- **Token Usage Normalization** — Consistent { input, output, total, reasoning } across all providers including MiMo hidden reasoning tokens
- **Streaming Support** — Parse SSE streams from MiMo, OpenAI, DeepSeek with consistent chunk format
- **Finish Reason Mapping** — Normalize stop, tool_calls, length, content_filter across providers
- **Error Detection** — Catches rate limits, content filters, and provider-specific errors
- **Provider Auto-Detection** — Identify provider from response shape when not specified
- **Zero Dependencies** — Pure ESM, Node.js 18+, nothing extra

---

## 🚀 Quick Start

### 1. Install

```bash
npm install llm-response-parser
```

### 2. Parse MiMo Responses

```javascript
import { parseResponse } from 'llm-response-parser';

// Parse MiMo v2.5-pro response (with thinking tokens)
const mimoRes = await fetch('https://token-plan-sgp.xiaomimimo.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.MIMO_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'mimo-v2.5-pro',
    messages: [{ role: 'user', content: 'Explain quantum computing' }],
  }),
});

const parsed = parseResponse(await mimoRes.json());
console.log(parsed.content);        // Main response text
console.log(parsed.thinking);       // MiMo reasoning content (invisible in raw response!)
console.log(parsed.usage);          // { input: 500, output: 200, total: 700, reasoning: 15000 }
console.log(parsed.provider);       // "mimo"
```

### 3. Same Code Works for Any Provider

```javascript
// OpenAI
const parsed = parseResponse(openaiJson);   // provider auto-detected as "openai"

// Anthropic
const parsed = parseResponse(anthropicJson); // provider auto-detected as "anthropic"

// DeepSeek
const parsed = parseResponse(deepseekJson);  // provider auto-detected as "deepseek"

// All return the same normalized format
```

### 4. CLI

```bash
# Parse MiMo response
curl -s https://token-plan-sgp.xiaomimimo.com/v1/chat/completions ... | llm-parse

# Parse with provider hint
cat response.json | llm-parse --provider mimo

# Extract thinking tokens only
cat response.json | llm-parse --extract thinking

# Show token usage
cat response.json | llm-parse --extract usage --format table
```

---

## 📦 Architecture

```
┌──────────────────────────────────────────────────┐
│               llm-response-parser                 │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │            Provider Detection               │ │
│  │   (auto-detect MiMo, OpenAI, Anthropic...)  │ │
│  └────────────────────┬────────────────────────┘ │
│                       │                           │
│  ┌────────────────────▼────────────────────────┐ │
│  │           Normalization Engine              │ │
│  │                                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │ Content  │ │ Tool     │ │ MiMo     │   │ │
│  │  │ Extractor│ │ Call     │ │ Thinking │   │ │
│  │  │          │ │ Normalizer│ │ Extractor│   │ │
│  │  └──────────┘ └──────────┘ └──────────┘   │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │ Usage    │ │ Finish   │ │ Error    │   │ │
│  │  │ Normalizer│ │ Reason   │ │ Detector │   │ │
│  │  └──────────┘ └──────────┘ └──────────┘   │ │
│  └─────────────────────────────────────────────┘ │
│                       │                           │
│  ┌────────────────────▼────────────────────────┐ │
│  │         Unified Response Object             │ │
│  │  { content, toolCalls, usage, finishReason, │ │
│  │    thinking, provider, raw }                │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 🖥️ CLI Reference

```bash
# Parse response from file or stdin
llm-parse response.json
cat response.json | llm-parse

# Provider hint (when auto-detect fails)
llm-parse response.json --provider mimo

# Extract specific fields
llm-parse response.json --extract content     # Just the text
llm-parse response.json --extract tools       # Just tool calls
llm-parse response.json --extract usage       # Token usage
llm-parse response.json --extract thinking    # MiMo/DeepSeek reasoning content
llm-parse response.json --extract all         # Full normalized object

# Output format
llm-parse response.json --format json         # JSON (default)
llm-parse response.json --format table        # Human-readable table
llm-parse response.json --format compact      # One-liner summary
```

---

## 📚 API Reference

### `parseResponse(raw, provider?)`

Parse any LLM response into a normalized object.

**Parameters:**
- `raw` — Raw response object from any provider
- `provider` — Optional provider hint: 'mimo', 'openai', 'anthropic', 'deepseek', 'minimax', 'openrouter'

**Returns:**

```javascript
{
  content: string,           // Main text response
  toolCalls: Array,          // Normalized tool calls: [{ id, name, arguments }]
  usage: {
    input: number,           // Input/prompt tokens
    output: number,          // Output/completion tokens
    total: number,           // Total tokens
    reasoning: number,       // MiMo/DeepSeek thinking tokens (0 if none)
  },
  finishReason: string,      // "stop" | "tool_calls" | "length" | "content_filter" | "error"
  thinking: string|null,     // MiMo reasoning_content (null if not thinking model)
  provider: string,          // Detected or specified provider
  model: string,             // Model identifier
  raw: object,               // Original response for debugging
}
```

### `extractToolCalls(raw)`

Extract and normalize tool calls from any provider format.

```javascript
// MiMo/OpenAI: message.tool_calls[].function.{name, arguments}
// Anthropic: content[].type === "tool_use", .name, .input
// All normalized to:
[{ id: string, name: string, arguments: object }]
```

### `extractUsage(raw)`

Extract and normalize token usage including MiMo thinking tokens.

```javascript
// MiMo: reasoning_content present but reasoning_tokens may be missing
// Parser estimates: reasoning_tokens = reasoning_content.length / 4
// Returns: { input, output, total, reasoning }
```

### `detectProvider(raw)`

Auto-detect provider from response shape.

```javascript
detectProvider(mimoResponse);     // "mimo"    (reasoning_content + mimo model)
detectProvider(openaiResponse);   // "openai"  (choices[] + message)
detectProvider(anthropicResponse); // "anthropic" (content[] without choices[])
detectProvider(deepseekResponse); // "deepseek" (reasoning_content + deepseek model)
```

### `parseStream(chunk, provider?)`

Parse a single SSE chunk from any provider.

```javascript
import { parseStream } from 'llm-response-parser/stream';

for await (const chunk of response.body) {
  const event = parseStream(chunk);
  if (event.type === 'content') process.stdout.write(event.text);
  if (event.type === 'thinking') debugLog(event.text);  // MiMo reasoning
  if (event.type === 'tool_call') handleTool(event);
  if (event.type === 'done') break;
}
```

---

## 📊 Provider Format Differences

### Tool Calls

| Provider | Location | Arguments Format |
|----------|----------|-----------------|
| MiMo | `message.tool_calls[].function` | JSON string |
| OpenAI | `message.tool_calls[].function` | JSON string |
| DeepSeek | `message.tool_calls[].function` | JSON string |
| Anthropic | `content[].type === "tool_use"` | Object |
| MiniMax | `message.tool_calls[].function` | JSON string |

### Token Usage

| Provider | Input | Output | Reasoning |
|----------|-------|--------|-----------|
| MiMo | `usage.prompt_tokens` | `usage.completion_tokens` | Hidden in reasoning_content |
| OpenAI | `usage.prompt_tokens` | `usage.completion_tokens` | `completion_tokens_details.reasoning_tokens` |
| DeepSeek | `usage.prompt_tokens` | `usage.completion_tokens` | `usage.reasoning_tokens` |
| Anthropic | `usage.input_tokens` | `usage.output_tokens` | N/A |

### Thinking Content

| Provider | Field | Notes |
|----------|-------|-------|
| MiMo | `reasoning_content` | Separate from content, may not have token count |
| DeepSeek | `reasoning_content` | Separate, has `reasoning_tokens` in usage |
| Qwen3 | `reasoning` | Toggle via `/no_think` prompt directive |
| Anthropic | `content[].type === "thinking"` | Block in content array |

---

## ⚠️ Pitfalls & Lessons Learned

### 1. MiMo Thinking Tokens Are Invisible

MiMo v2.5-pro puts reasoning in `reasoning_content` but does NOT always include a separate `reasoning_tokens` count in `usage`. Your parser must either estimate (chars / 4) or track the content length. If you only check `usage.completion_tokens`, you'll miss 90% of the actual cost.

```javascript
// ❌ This misses MiMo thinking tokens
const tokens = response.usage.completion_tokens;

// ✅ This captures the full picture
const parsed = parseResponse(response);
const realTokens = parsed.usage.total; // Includes estimated reasoning
```

### 2. Anthropic Tool Calls Are in `content[]`, Not `tool_calls`

The biggest source of production bugs. MiMo, OpenAI, DeepSeek, and MiniMax all put tool calls in `message.tool_calls`. Anthropic puts them in `content[]` as items with `type: "tool_use"`. Always use `extractToolCalls()` instead of accessing raw fields.

### 3. `arguments` Can Be String or Object

MiMo and OpenAI return tool call arguments as a JSON string. Anthropic returns a parsed object. Some providers return empty string for malformed calls. The parser normalizes all to objects and returns `{}` for invalid input.

### 4. Streaming Chunks Have No Standard Format

MiMo and OpenAI send `data: {"choices":[{"delta":{"content":"Hello"}}]}`. Anthropic sends `event: content_block_delta` with `{"delta":{"text":"Hello"}}`. MiMo may include `reasoning_content` in deltas for thinking models. The stream parser handles all formats.

### 5. `finish_reason` Is Named Differently

MiMo/OpenAI use `finish_reason`, Anthropic uses `stop_reason`, some providers omit it entirely. The normalizer maps all to `finishReason` with consistent values.

---

## 📄 License

MIT — [Hijrah Assalam](LICENSE)
