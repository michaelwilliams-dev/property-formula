// script.js
// ISO Timestamp: 2025-07-30T00:00:00Z

// Display ISO timestamp
document.getElementById('iso-timestamp').textContent = new Date().toISOString();

// Handle "Generate Blog" button
document.getElementById('generate').addEventListener('click', async () => {
  const topic = document.getElementById('topic').value.trim();
  const email = document.getElementById('email').value.trim();
  const responseEl = document.getElementById('response');

  if (!topic) {
    responseEl.textContent = '❌ Please enter a blog topic.';
    return;
  }

  responseEl.textContent = '⏳ Generating blog...';

  try {
    const res = await fetch('/api/blog-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, email })
    });

    const data = await res.json();
    responseEl.textContent = data.blog || '⚠️ No blog returned.';
  } catch (err) {
    responseEl.textContent = '❌ Request failed: ' + err.message;
  }
});
