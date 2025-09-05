const GEMINI_API_KEY = "AIzaSyB91rtkHPS0HFfWLl_2_9kxLIVUnqLlMvM";
let currentDocText = "";

// ---------- Format AI responses ----------
function formatAIResponse(text) {
  if (!text) return "No content.";

  let formatted = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  formatted = formatted.replace(/^### (.*)$/gim, "<h3>$1</h3>");
  formatted = formatted.replace(/^## (.*)$/gim, "<h2>$1</h2>");
  formatted = formatted.replace(/^# (.*)$/gim, "<h1>$1</h1>");

  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");

  formatted = formatted.replace(/^\s*\* (.*)$/gim, "<li>$1</li>");
  formatted = formatted.replace(
    /(<li>.*<\/li>)(\s*<li>.*<\/li>)+/gims,
    (match) => {
      return "<ul>" + match + "</ul>";
    }
  );

  formatted = formatted.replace(
    /^(?!<h\d|<ul|<li|<\/ul|<\/li)(.+)$/gim,
    "<p>$1</p>"
  );

  return formatted;
}

// ---------- Generate dynamic quick questions ----------
async function generateQuickQuestions(docText) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate 3-5 relevant, useful questions a user might ask about the following document. 
Return only the questions as a numbered list without any intro text.\n\nDocument:\n${docText}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let questions = rawText
      .split(/\n/)
      .map((q) => q.replace(/^\d+\.\s*/, "").trim())
      .filter((q) => q.length > 0);

    if (questions.length && /^here are/i.test(questions[0])) {
      questions = questions.slice(1);
    }

    return questions.length
      ? questions
      : [
          "What is the main topic?",
          "Summarize key points",
          "What are the action items?",
        ];
  } catch (err) {
    console.error("Quick questions generation failed:", err);
    return [
      "What is the main topic?",
      "Summarize key points",
      "What are the action items?",
    ];
  }
}

// ---------- Process Google Doc ----------
document.getElementById("process-btn").addEventListener("click", async () => {
  const url = document.getElementById("doc-url").value.trim();
  const statusBox = document.getElementById("upload-status");
  const responseBox = document.getElementById("response-box");

  statusBox.innerHTML = "📄 Fetching document...";
  responseBox.innerHTML = "";

  try {
    const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    if (!docIdMatch) throw new Error("Invalid Google Doc URL format.");
    const docId = docIdMatch[1];

    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const response = await fetch(exportUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch. Status ${response.status}`);

    currentDocText = await response.text();
    if (!currentDocText.trim())
      throw new Error("Document is empty or not shared publicly.");

    statusBox.innerHTML = "✅ Document uploaded successfully!";
    responseBox.innerHTML =
      "<p class='placeholder'>Document loaded. You can now ask questions!</p>";

    const quickContainer = document.querySelector(".quick-questions");
    quickContainer.innerHTML = "";
    const questions = await generateQuickQuestions(currentDocText);

    questions.forEach((q) => {
      const btn = document.createElement("button");
      btn.className = "quick";
      btn.textContent = q;
      btn.addEventListener("click", () => {
        document.getElementById("user-question").value = q;
        document.getElementById("ask-btn").click();
      });
      quickContainer.appendChild(btn);
    });
  } catch (err) {
    console.error("Doc fetch error:", err);
    statusBox.innerHTML = "❌ Error: " + err.message;
  }
});

// ---------- Ask AI ----------
document.getElementById("ask-btn").addEventListener("click", async () => {
  const question = document.getElementById("user-question").value.trim();
  const responseBox = document.getElementById("response-box");

  if (!currentDocText) {
    responseBox.innerHTML = "<p>⚠️ Please load a document first.</p>";
    return;
  }
  if (!question) {
    responseBox.innerHTML = "<p>⚠️ Please type a question.</p>";
    return;
  }

  responseBox.innerHTML = "🤔 Thinking...";

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Document:\n${currentDocText}\n\nQuestion: ${question}\nAnswer:`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const rawAnswer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    responseBox.innerHTML =
      formatAIResponse(rawAnswer) || "⚠️ No answer generated.";
  } catch (err) {
    console.error("Ask error:", err);
    responseBox.innerHTML = "❌ Error: " + err.message;
  }
});
