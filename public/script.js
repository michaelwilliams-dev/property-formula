// script.js
// ISO Timestamp: 2025-07-30T00:00:00Z

// Display ISO timestamp
document.getElementById('iso-timestamp').textContent = new Date().toISOString();

// 🔧 BACKEND CONFIG — change this if running locally or on Render
const BACKEND_URL = 'https://propertyformula-blog-backend.onrender.com/ask';

// Handle "Ask" button
document.getElementById('ask').addEventListener('click', async () => {
  const question = document.getElementById('question').value.trim();
  const responseEl = document.getElementById('response');
  
  if (!question) {
    responseEl.textContent = '❌ Please enter a question.';
    return;
  }

  responseEl.textContent = '⏳ Thinking...';

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        client: 'PropertyFormula_2025-07-27'
      })
    });

    const data = await res.json();
    responseEl.textContent = data.answer || '⚠️ No answer returned.';
  } catch (err) {
    responseEl.textContent = '❌ Request failed: ' + err.message;
  }
});