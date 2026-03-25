import Anthropic from '@anthropic-ai/sdk';
import env from '../config/env.js';

let anthropicClient = null;

export class AIClientConfigError extends Error {
  constructor(message, code = 'AI_UNAVAILABLE') {
    super(message);
    this.name = 'AIClientConfigError';
    this.code = code;
  }
}

export function getAnthropicClient() {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AIClientConfigError('ANTHROPIC_API_KEY is not configured');
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  return anthropicClient;
}

export async function createAnthropicMessage(payload) {
  return getAnthropicClient().messages.create(payload);
}

export function streamAnthropicMessages(payload) {
  return getAnthropicClient().messages.stream(payload);
}
