// server.js
// ISO Timestamp: 2025-07-29T14:10:00Z

import express from 'express';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import OpenAI from 'openai';
import cors from 'cors';

config();
const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const VECTOR_INDEX_PATH = path.resolve('../chunking_and_indexing/vector_index.json');
let vectorIndex = [];

// Load vector index at startup
try {
  const rawData = fs.readFileSync(VECTOR_INDEX_PATH);
  vectorIndex = JSON.parse(rawData);
  console.log(`✅ Loaded ${vectorIndex.length} vectors`);
} catch (err) {
  console.error(`❌ Failed to load vector index: ${err.message}`);
  process.exit(1);
}

// Cosine similarity
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// Search top N
async function getRelevantChunks(topicEmbedding, topK = 5) {
  return vectorIndex
    .map(item => ({
      ...item,
      score: cosineSimilarity(topicEmbedding, item.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// POST /api/blog-draft
app.post('/api/blog-draft', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Get embedding of topic
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: topic
    });

    const topicEmbedding = embeddingResponse.data[0].embedding;
    const topChunks = await getRelevantChunks(topicEmbedding, 5);
    const context = topChunks.map(c => `• ${c.filename}`).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a RCS property surveyor wrinting a usful blog writer. Use the provided documents to write a helpful and accurate blog post on the given topic.`
        },
        {
          role: 'user',
          content: `Topic: ${topic}\n\nDocuments:\n${context}\n\nPlease write a 3–4 paragraph blog post suitable for our client’s website.`
        }
      ],
      temperature: 0.6
    });

    const blogText = completion.choices[0].message.content;
    res.json({ topic, blog: blogText });
  } catch (err) {
    console.error('❌ Error generating blog:', err);
    res.status(500).json({ error: 'Blog generation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Blog assistant running at http://localhost:${PORT}`);
});