# 🔍 LLM Response Parser

**Normalize any LLM provider's response into a consistent format. One parser, every model.**

[![npm](https://img.shields.io/npm/v/llm-response-parser?color=blue)](https://www.npmjs.com/package/llm-response-parser)
[![license](https://img.shields.io/npm/l/llm-response-parser?color=green)](LICENSE)
[![node](https://img.shields.io/node/v/llm-response-parser)](package.json)
[![zero deps](https://img.shields.io/dependencies-0-brightgreen)](package.json)

A zero-dependency library for parsing, normalizing, and extracting data from LLM API responses across all major providers. Handles tool calls, thinking tokens, streaming, and provider quirks automatically.

---

## ⚠️ Real-World Pitfall

> **A production agent silently returned null for 3 hours because Anthropic puts tool calls in `content[0]`, not `message.tool_calls`.**
>
> My code checked `response.choices[0].message.tool_calls` (OpenAI format) against an Anthropic response. No error, no crash, just null. The agent kept responding "I don't have enough information" to every user query for 3 hours before anyone noticed.
>
> Different providers return the same data in completely different structures. This library normalizes all of them.

---

## ✨ Features

- **Universal Parser** — One function parses OpenAI, Anthropic, DeepSeek, MiMo, MiniMax, OpenRouter, and custom providers
- **Tool Call Extraction** — Normalizes tool_calls regardless of provider format
- **Thinking Token Handling** — Extracts reasoning_content, thinking, and extended_thinking fields
- **Streaming Support** — Parse SSE streams from any provider with consistent chunk format
- **Token Usage Normalization** — Consistent { input, output, total, reasoning } across all providers
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

### 2. Parse Any Response

```javascript
import { parseResponse } from 'llm-response-parser';

// Works with OpenAI
const openai = await fetch('https://api.openai.com/v1/chat/completions', { ... });
const parsed = parseResponse(await openai.json());
console.log(parsed.content);        // "Hello, how can I help?"
console.log(parsed.toolCalls);      // [{ id, name, arguments }]
console.log(parsed.usage);          // { input: 150, output: 50, total: 200, reasoning: 0 }
console.log(parsed.finishReason);   // "stop"
console.log(parsed.provider);       // "openai"

// Same code works with Anthropic, MiMo, DeepSeek, etc.
const mimo = await fetch('https://token-plan-sgp.xiaomimimo.com/v1/chat/completions', { ... });
const parsed2 = parseResponse(await mimo.json());
// Identical output format
```

### 3. Parse Tool Calls

```javascript
import { extractToolCalls } from 'llm-response-parser';

const calls = extractToolCalls(response);
// Always returns: [{ id: string, name: string, arguments: object }]
// Regardless of whether the response came from OpenAI, Anthropic, MiMo, etc.
```

### 4. CLI

```bash
# Parse a response from stdin
cat response.json | llm-parse

# Parse with explicit provider hint
cat response.json | llm-parse --provider anthropic

# Extract only tool calls
cat response.json | llm-parse --extract tools

# Show token usage
cat response.json | llm-parse --extract usage
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
│  │   (auto-detect from response shape)         │ │
│  └────────────────────┬────────────────────────┘ │
│                       │                           │
│  ┌────────────────────▼────────────────────────┐ │
│  │           Normalization Engine              │ │
│  │                                             │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │ Content  │ │ Tool     │ │ Thinking │   │ │
│  │  │ Extractor│ │ Call     │ │ Token    │   │ │
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
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │         Stream Parser (SSE)                 │ │
│  │  Parse chunks from any provider into        │ │
│  │  consistent streaming events                │ │
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
llm-parse response.json --provider deepseek

# Extract specific fields
llm-parse response.json --extract content     # Just the text
llm-parse response.json --extract tools       # Just tool calls
llm-parse response.json --extract usage       # Token usage
llm-parse response.json --extract thinking    # Reasoning content
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
- `provider` — Optional provider hint: 'openai', 'anthropic', 'deepseek', 'mimo', 'minimax', 'openrouter'

**Returns:**

```javascript
{
  content: string,           // Main text response
  toolCalls: Array,          // Normalized tool calls
  usage: {
    input: number,           // Input/prompt tokens
    output: number,          // Output/completion tokens
    total: number,           // Total tokens
    reasoning: number,       // Thinking/reasoning tokens (0 if none)
  },
  finishReason: string,      // "stop" | "tool_calls" | "length" | "content_filter" | "error"
  thinking: string|null,     // Thinking/reasoning content (if thinking model)
  provider: string,          // Detected or specified provider
  model: string,             // Model identifier
  raw: object,               // Original response for debugging
}
```

### `extractToolCalls(raw)`

Extract and normalize tool calls from any provider format.

```javascript
// OpenAI format: message.tool_calls[].function.{name, arguments}
// Anthropic format: content[].type === "tool_use", .name, .input
// DeepSeek: same as OpenAI but arguments may be string or object
// MiMo: same as OpenAI, may include thinking tokens
// All normalized to:
[{ id: string, name: string, arguments: object }]
```

### `extractUsage(raw)`

Extract and normalize token usage.

```javascript
// OpenAI: usage.prompt_tokens, usage.completion_tokens
// Anthropic: usage.input_tokens, usage.output_tokens
// DeepSeek: usage.prompt_tokens, usage.completion_tokens, usage.reasoning_tokens
// MiMo: usage.prompt_tokens, usage.completion_tokens (thinking in completion)
// All normalized to:
{ input: number, output: number, total: number, reasoning: number }
```

### `detectProvider(raw)`

Auto-detect provider from response shape.

```javascript
detectProvider(openaiResponse);   // "openai"
detectProvider(anthropicResponse); // "anthropic"
detectProvider(mimoResponse);     // "mimo"
```

### `parseStream(chunk, provider?)`

Parse a single SSE chunk from any provider.

```javascript
import { parseStream } from 'llm-response-parser/stream';

for await (const chunk of response.body) {
  const event = parseStream(chunk);
  if (event.type === 'content') process.stdout.write(event.text);
  if (event.type === 'tool_call') console.log('Tool:', event.name);
  if (event.type === 'done') break;
}
```

---

## 📊 Provider Format Differences

How the same data appears across providers:

### Tool Calls

| Provider | Location | Format |
|----------|----------|--------|
| OpenAI | `message.tool_calls[].function` | `{ name, arguments: "json-string" }` |
| Anthropic | `content[].type === "tool_use"` | `{ name, input: object }` |
| DeepSeek | `message.tool_calls[].function` | `{ name, arguments: "json-string" }` |
| MiMo | `message.tool_calls[].function` | `{ name, arguments: "json-string" }` |
| MiniMax | `message.tool_calls[].function` | `{ name, arguments: "json-string" }` |

### Token Usage

| Provider | Input Field | Output Field | Reasoning Field |
|----------|-------------|--------------|-----------------|
| OpenAI | `usage.prompt_tokens` | `usage.completion_tokens` | `usage.completion_tokens_details.reasoning_tokens` |
| Anthropic | `usage.input_tokens` | `usage.output_tokens` | N/A |
| DeepSeek | `usage.prompt_tokens` | `usage.completion_tokens` | `usage.reasoning_tokens` |
| MiMo | `usage.prompt_tokens` | `usage.completion_tokens` | Hidden in completion |

### Thinking Content

| Provider | Field | Notes |
|----------|-------|-------|
| MiMo | `reasoning_content` | Separate from content |
| DeepSeek | `reasoning_content` | Separate from content |
| Qwen3 | `reasoning` or `/no_think` | Toggle via prompt |
| Anthropic | `thinking` block | `content[0].type === "thinking"` |

---

## ⚠️ Pitfalls & Lessons Learned

### 1. Anthropic Tool Calls Are Not in `tool_calls`

The biggest source of production bugs. OpenAI, DeepSeek, MiMo, and MiniMax all put tool calls in `message.tool_calls`. Anthropic puts them in `content[]` as items with `type: "tool_use"`. Always use `extractToolCalls()` instead of accessing raw fields.

### 2. Thinking Tokens Are Often Hidden

MiMo v2.5-pro and DeepSeek Reasoner include thinking tokens in `usage.completion_tokens` without a separate count. The parser detects this by checking for `reasoning_content` and adjusting the split accordingly.

### 3. `arguments` Can Be String or Object

OpenAI returns tool call arguments as a JSON string. Some providers return a parsed object. Others return an empty string for malformed calls. The parser normalizes all to objects and returns `{}` for invalid input.

### 4. Streaming Chunks Have No Standard Format

OpenAI sends `data: {"choices":[{"delta":{"content":"Hello"}}]}`. Anthropic sends `event: content_block_delta` with `{"delta":{"text":"Hello"}}`. MiMo follows OpenAI format but may include `reasoning_content` in deltas. The stream parser handles all formats.

### 5. `finish_reason` Is Named Differently

OpenAI uses `finish_reason`, Anthropic uses `stop_reason`, and some providers omit it entirely. The normalizer maps all to `finishReason` with values: `stop`, `tool_calls`, `length`, `content_filter`, `error`.

---

## 📄 License

MIT — [Hijrah Assalam](LICENSE)
