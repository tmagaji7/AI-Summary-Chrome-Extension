function getArticleText() {
  // Prefer <article> if it exists and has visible text
  const article = document.querySelector("article");
  if (article && article.innerText.trim() !== "") {
    return article.innerText.trim();
  }

  // Fallback: combine all visible <p> tags
  const paragraphs = Array.from(document.querySelectorAll("p"))
    .filter(p => p.offsetParent !== null && p.innerText.trim() !== "");
  if (paragraphs.length > 0) {
    return paragraphs.map((p) => p.innerText.trim()).join("\n\n");
  }

  // Fallback: combine all visible <div> tags with text (common in modern sites)
  const divs = Array.from(document.querySelectorAll("div"))
    .filter(div => div.offsetParent !== null && div.innerText.trim() !== "");
  if (divs.length > 0) {
    return divs.map((div) => div.innerText.trim()).join("\n\n");
  }

  // Ultimate fallback: entire visible body text
  const bodyText = document.body.innerText.trim();
  if (bodyText !== "") {
    return bodyText;
  }

  // If still nothing, return null
  return null;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_ARTICLE_TEXT") {
    const text = getArticleText();
    sendResponse({ text });
  }
});
