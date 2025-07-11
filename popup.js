// Main Summarize button click handler
document.getElementById("summarize").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';

  const summaryType = document.getElementById("summary-type").value;
  const language = document.getElementById("language").value;

  // Default to Gemini if no model dropdown
  let selectedModel = "gemini";
  const modelElement = document.getElementById("model");
  if (modelElement) {
    selectedModel = modelElement.value;
  }

  chrome.storage.sync.get(["geminiApiKey", "openAiApiKey", "claudeApiKey", "llamaApiKey"], async (result) => {
    let apiKey;
    switch (selectedModel) {
      case "gemini":
        apiKey = result.geminiApiKey;
        break;
      case "gpt-4":
        apiKey = result.openAiApiKey;
        break;
      case "claude":
        apiKey = result.claudeApiKey;
        break;
      case "llama":
        apiKey = result.llamaApiKey;
        break;
    }

    if (!apiKey) {
      resultDiv.innerHTML = `🔑 API key for ${selectedModel.toUpperCase()} not found. Set it in options.`;
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || !tab.id) {
        resultDiv.innerText = "⚠️ No active tab found.";
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content.js"]
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error("❌ Failed to inject content script:", chrome.runtime.lastError.message);
            resultDiv.innerText = "🚫 This page doesn’t allow content scripts. Try a different site.";
            return;
          }

          chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" }, async (res) => {
            if (!res || !res.text) {
              resultDiv.innerText = "📄 Could not extract article text.";
              return;
            }

            try {
              const summary = await fetchSummaryFromModel(selectedModel, res.text, summaryType, language, apiKey);
              resultDiv.innerHTML = summary
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // bold
                .replace(/\*(.*?)\*/g, '<em>$1</em>')            // italic
                .replace(/(?:\r\n|\r|\n)/g, '<br>');             // line breaks
            } catch (error) {
              console.error("❌ Error generating summary:", error);
              resultDiv.innerText = `🚨 Error: ${error?.message || error?.toString() || "Failed to generate summary."}`;
            }
          });
        }
      );
    });
  });
});

// Copy summary to clipboard
document.getElementById("copy-btn").addEventListener("click", () => {
  const summaryText = document.getElementById("result").innerText;
  if (summaryText && summaryText.trim() !== "") {
    navigator.clipboard.writeText(summaryText).then(() => {
      const copyBtn = document.getElementById("copy-btn");
      const originalText = copyBtn.innerText;
      copyBtn.innerText = "✅ Copied!";
      setTimeout(() => {
        copyBtn.innerText = originalText;
      }, 2000);
    }).catch((err) => {
      console.error("❌ Failed to copy text: ", err);
    });
  }
});

// ✅ fetchSummaryFromModel stays the same
async function fetchSummaryFromModel(model, text, summaryType, language, apiKey) {
  const maxLength = 20000;
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  let prompt;
  switch (summaryType) {
    case "brief":
      prompt = `Provide a brief summary (2-3 sentences) in ${language}:\n\n${truncatedText}`;
      break;
    case "detailed":
      prompt = `Provide a detailed summary in ${language}, covering all key points:\n\n${truncatedText}`;
      break;
    case "bullets":
      prompt = `Summarize in ${language} as 5-7 key points:\n\n${truncatedText}`;
      break;
    default:
      prompt = `Summarize this article in ${language}:\n\n${truncatedText}`;
  }

  let url, body, headers;

  if (model === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    });
    headers = { "Content-Type": "application/json" };
  } else if (model === "gpt-4") {
    url = "https://api.openai.com/v1/chat/completions";
    body = JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });
    headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };
  } else if (model === "claude") {
    url = "https://api.anthropic.com/v1/complete";
    body = JSON.stringify({
      prompt: prompt,
      model: "claude-2",
      max_tokens_to_sample: 1024,
      temperature: 0.2
    });
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    };
  } else if (model === "llama") {
    url = "https://api.llama.ai/v1/completions";
    body = JSON.stringify({
      prompt: prompt,
      max_tokens: 1024,
      temperature: 0.2
    });
    headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };
  }

  const response = await fetch(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "API request failed");
  }

  const data = await response.json();
  if (model === "gemini") {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary available.";
  } else if (model === "gpt-4") {
    return data?.choices?.[0]?.message?.content || "No summary available.";
  } else if (model === "claude") {
    return data?.completion || "No summary available.";
  } else if (model === "llama") {
    return data?.choices?.[0]?.text || "No summary available.";
  }
}
