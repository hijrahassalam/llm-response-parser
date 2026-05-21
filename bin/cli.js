#!/usr/bin/env node

import { parseResponse, extractToolCalls, extractUsage, detectProvider } from '../src/parser.js';

const args = process.argv.slice(2);

function usage() {
  console.log(`
llm-parse — Universal LLM response parser

Usage:
  cat response.json | llm-parse [options]
  llm-parse response.json [options]

Options:
  --provider <name>    Provider hint (openai, anthropic, deepseek, mimo, minimax, openrouter)
  --extract <field>    Extract specific field: content, tools, usage, thinking, all
  --format <fmt>       Output format: json (default), table, compact
  --help               Show this help
  `);
}

if (args.includes('--help')) {
  usage();
  process.exit(0);
}

// Read input
let input = '';
const file = args.find(a => !a.startsWith('--'));

if (file) {
  const fs = await import('node:fs');
  input = fs.readFileSync(file, 'utf-8');
} else {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  input = Buffer.concat(chunks).toString('utf-8');
}

if (!input.trim()) {
  console.error('Error: no input provided');
  process.exit(1);
}

let raw;
try {
  raw = JSON.parse(input);
} catch (e) {
  console.error('Error: invalid JSON:', e.message);
  process.exit(1);
}

// Parse options
function getOpt(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const provider = getOpt('provider');
const extract = getOpt('extract') || 'all';
const format = getOpt('format') || 'json';

const parsed = parseResponse(raw, provider);

let output;
if (extract === 'content') {
  output = parsed.content;
} else if (extract === 'tools') {
  output = parsed.toolCalls;
} else if (extract === 'usage') {
  output = parsed.usage;
} else if (extract === 'thinking') {
  output = parsed.thinking;
} else {
  output = parsed;
}

if (format === 'json') {
  console.log(JSON.stringify(output, null, 2));
} else if (format === 'table') {
  if (extract === 'usage') {
    console.log(`Provider:  ${parsed.provider}`);
    console.log(`Model:     ${parsed.model}`);
    console.log(`Input:     ${parsed.usage.input} tokens`);
    console.log(`Output:    ${parsed.usage.output} tokens`);
    console.log(`Reasoning: ${parsed.usage.reasoning} tokens`);
    console.log(`Total:     ${parsed.usage.total} tokens`);
  } else if (extract === 'tools') {
    for (const tc of parsed.toolCalls) {
      console.log(`  ${tc.name}(${JSON.stringify(tc.arguments)})`);
    }
  } else {
    console.log(`Provider:    ${parsed.provider}`);
    console.log(`Model:       ${parsed.model}`);
    console.log(`Finish:      ${parsed.finishReason}`);
    console.log(`Content:     ${parsed.content.slice(0, 200)}${parsed.content.length > 200 ? '...' : ''}`);
    console.log(`Tool calls:  ${parsed.toolCalls.length}`);
    console.log(`Tokens:      ${parsed.usage.total} (in: ${parsed.usage.input}, out: ${parsed.usage.output}, reason: ${parsed.usage.reasoning})`);
    console.log(`Thinking:    ${parsed.thinking ? parsed.thinking.slice(0, 100) + '...' : 'none'}`);
  }
} else if (format === 'compact') {
  const tc = parsed.toolCalls.length > 0 ? ` | ${parsed.toolCalls.length} tools` : '';
  const th = parsed.thinking ? ' | thinking' : '';
  console.log(`${parsed.provider}/${parsed.model} | ${parsed.finishReason} | ${parsed.usage.total} tokens${tc}${th}`);
}
