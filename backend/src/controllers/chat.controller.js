import Anthropic   from '@anthropic-ai/sdk';
import { DEH_SYSTEM_PROMPT } from '../config/constants.js';
import store from '../store.js';
import { getSafeModel } from '../lib/helpers.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function chat(req, res) {
  const { messages, system } = req.validated;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const timeout = setTimeout(() => {
    res.write('data: [TIMEOUT]\n\n');
    res.end();
  }, 60000);

  try {
    const stream = anthropic.messages.stream({
      model:      getSafeModel(store.settings),
      max_tokens: 2048,
      system:     system || DEH_SYSTEM_PROMPT,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
      if (res.writableEnded) break;
    }

    clearTimeout(timeout);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    clearTimeout(timeout);
    console.error('[/api/chat]', err.message);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'AI service error' })}\n\n`);
      res.end();
    }
  }
}
