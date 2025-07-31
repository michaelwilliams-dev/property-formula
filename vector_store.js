// vector_store.js
// ISO Timestamp: 🕒 2025-07-31T20:45:00Z (Clean version with input validation)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { OpenAI } from 'openai';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function loadIndex() {
  const indexPath = path.join(__dirname, 'vector_index.json');
  const data = await fs.readFile(indexPath, 'utf-8');
  const parsed = JSON.parse(data);
  return parsed.vectors || [];
}

export async function searchIndex(query, index) {
  if (typeof query !== 'string' || !query.trim()) {
    console.warn("⚠️ Skipping embedding: invalid query:", query);
    return [];
  }

  console.log("🔍 Searching index for:", query);

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: [query],
  });

  const queryEmbedding = response.data[0].embedding;

  const scores = index.map(item => {
    const dot = dotProduct(queryEmbedding, item.embedding);
    return { ...item, score: dot };
  });

  const sorted = scores.sort((a, b) => b.score - a.score);
  return sorted.slice(0, 3);
}

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
