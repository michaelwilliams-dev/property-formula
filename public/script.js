// script.js
// ISO Timestamp: 🕒 2025-08-01T10:55:00Z

document.addEventListener("DOMContentLoaded", () => {
  const generateBtn = document.getElementById("generate");
  const topicInput = document.getElementById("topic");
  const emailInput = document.getElementById("email");
  const output = document.getElementById("response");

  generateBtn.addEventListener("click", async () => {
    const topic = topicInput.value.trim();
    const email = emailInput.value.trim();
    if (!topic) {
      output.textContent = "❌ Please enter a blog topic.";
      return;
    }

    output.textContent = "⏳ Generating blog post...";
    generateBtn.disabled = true;

    try {
      const res = await fetch("/api/blog-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, email })
      });

      const data = await res.json();
      output.textContent = data.blogText || "⚠️ No blog returned.";
    } catch (err) {
      console.error(err);
      output.textContent = "❌ Failed to contact blog API.";
    }

    generateBtn.disabled = false;
  });
});
