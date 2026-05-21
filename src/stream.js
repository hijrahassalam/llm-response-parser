/**
 * Parse SSE stream chunks from any provider.
 *
 * @param {string|Buffer} chunk - Raw SSE chunk
 * @param {string} provider - Provider hint
 * @returns {Object} Parsed stream event
 */
export function parseStream(chunk, provider) {
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
  const lines = text.split('\n').filter(l => l.trim());

  const events = [];

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        events.push({ type: 'done' });
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const event = parseStreamEvent(parsed, provider);
        if (event) events.push(event);
      } catch {
        // Skip malformed JSON
      }
    } else if (line.startsWith('event: ')) {
      // Anthropic-style event type
      const eventType = line.slice(7).trim();
      events.push({ type: 'event', eventType });
    }
  }

  return events.length === 1 ? events[0] : events;
}

function parseStreamEvent(data, provider) {
  // Anthropic format
  if (data.type === 'content_block_delta') {
    if (data.delta?.type === 'text_delta') {
      return { type: 'content', text: data.delta.text };
    }
    if (data.delta?.type === 'thinking_delta') {
      return { type: 'thinking', text: data.delta.thinking };
    }
    if (data.delta?.type === 'input_json_delta') {
      return { type: 'tool_call_delta', arguments: data.delta.partial_json };
    }
  }

  if (data.type === 'content_block_start') {
    if (data.content_block?.type === 'tool_use') {
      return {
        type: 'tool_call_start',
        id: data.content_block.id,
        name: data.content_block.name,
      };
    }
  }

  if (data.type === 'message_delta') {
    return {
      type: 'done',
      finishReason: data.delta?.stop_reason || 'stop',
      usage: data.usage ? {
        input: data.usage.input_tokens || 0,
        output: data.usage.output_tokens || 0,
        total: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
        reasoning: 0,
      } : null,
    };
  }

  // OpenAI / DeepSeek / MiMo format
  const choice = data.choices?.[0];
  if (!choice) return null;

  const delta = choice.delta || {};

  if (delta.content) {
    return { type: 'content', text: delta.content };
  }

  if (delta.reasoning_content) {
    return { type: 'thinking', text: delta.reasoning_content };
  }

  if (delta.tool_calls) {
    return {
      type: 'tool_call',
      toolCalls: delta.tool_calls.map(tc => ({
        index: tc.index,
        id: tc.id,
        name: tc.function?.name,
        arguments: tc.function?.arguments,
      })),
    };
  }

  if (choice.finish_reason) {
    return {
      type: 'done',
      finishReason: choice.finish_reason,
      usage: data.usage ? {
        input: data.usage.prompt_tokens || 0,
        output: data.usage.completion_tokens || 0,
        total: (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0),
        reasoning: data.usage.reasoning_tokens || 0,
      } : null,
    };
  }

  return null;
}
