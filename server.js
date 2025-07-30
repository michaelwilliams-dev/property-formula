// server.js
// ISO Timestamp: 🕒 2025-07-30T18:15:00Z

import express from 'express';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { Buffer } from 'buffer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// 🕒 Startup log
console.log(`🕒 Server started at ${new Date().toISOString()}`);

// File path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VECTOR_INDEX_PATH = path.resolve(__dirname, './vector_index.json');
let vectorIndex = [];
try {
  const parsed = JSON.parse(fs.readFileSync(VECTOR_INDEX_PATH));
  vectorIndex = Array.isArray(parsed) ? parsed : parsed.vectors;
  console.log(`✅ Loaded ${vectorIndex.length} vectors`);
} catch (err) {
  console.error(`❌ Failed to load vector index: ${err.message}`);
  process.exit(1);
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

function getTopChunks(queryEmbedding, k = 5) {
  return vectorIndex
    .map(item => ({
      ...item,
      score: cosineSimilarity(queryEmbedding, item.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

app.post('/api/blog-draft', async (req, res) => {
  const { topic, email } = req.body;
  console.log("🔁 Received blog draft request:", topic);

  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  try {
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: topic
    });

    if (!embedding?.data?.[0]) {
      throw new Error('Embedding failed or returned empty data.');
    }

    console.log("🔎 Embedding received");

    const topChunks = getTopChunks(embedding.data[0].embedding, 5);
    const context = topChunks.map(c => `• ${c.filename || c.text}`).join('\n');

    const prompt = `We are RICS chartered surveyors and valuers. Write a professional blog post on the topic: "${topic}". Use only the content below. Do not make anything up.\n\nDocuments:\n${context}\n\nInclude headline, intro, key points, and wrap-up.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6
    });

    console.log("\ud83e\uddea OpenAI raw response:", JSON.stringify(completion, null, 2));

    if (!completion?.choices || !Array.isArray(completion.choices) || !completion.choices.length) {
      throw new Error('OpenAI returned no choices.');
    }

    const firstChoice = completion.choices[0];
    if (!firstChoice.message || !firstChoice.message.content) {
      throw new Error('OpenAI returned an empty message.');
    }

    const blogText = firstChoice.message.content;

    if (email && email.includes('@')) {
      try {
        const pdfDoc = new PDFDocument();
        let pdfBuffer = Buffer.alloc(0);
        pdfDoc.on('data', chunk => { pdfBuffer = Buffer.concat([pdfBuffer, chunk]); });
        pdfDoc.text(blogText);
        pdfDoc.end();

        const doc = new Document({
          sections: [{ children: [new Paragraph({ children: [new TextRun(blogText)] })] }],
        });
        const docBuffer = await Packer.toBuffer(doc);

        const mailjetRes = await fetch("https://api.mailjet.com/v3.1/send", {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${process.env.MJ_APIKEY_PUBLIC}:${process.env.MJ_APIKEY_PRIVATE}`).toString("base64"),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            Messages: [
              {
                From: { Email: "noreply@securemaildrop.uk", Name: "Secure Maildrop" },
                To: [{ Email: email }],
                Subject: `Your AI blog: ${topic}`,
                TextPart: blogText,
                HTMLPart: blogText.split('\n').map(line => `<p>${line}</p>`).join(''),
                Attachments: [
                  {
                    ContentType: "application/pdf",
                    Filename: `${topic}.pdf`,
                    Base64Content: pdfBuffer.toString('base64')
                  },
                  {
                    ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    Filename: `${topic}.docx`,
                    Base64Content: docBuffer.toString('base64')
                  }
                ]
              }
            ]
          })
        });

        const mailResponse = await mailjetRes.json();
        console.log("📨 Mailjet response:", mailjetRes.status, mailResponse);
      } catch (err) {
        console.error("❌ Mailjet send failed:", err.message);
      }
    }

    res.json({ topic, blog: blogText });

  } catch (err) {
    console.error('❌ Blog generation failed:', err.message);
    res.status(500).json({ error: 'Blog generation failed' });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('PropertyFormula assistant is live.');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PropertyFormula backend running at http://localhost:${PORT}`);
});
