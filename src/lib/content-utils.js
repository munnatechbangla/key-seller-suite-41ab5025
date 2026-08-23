/**
 * Formats a description string to ensure proper HTML rendering.
 * If the content already contains HTML tags, it's returned as is.
 * Otherwise, it converts newlines into paragraph tags.
 */
export function formatDescription(text) {
    if (!text)
        return "";
    // Basic check for HTML tags
    if (/<(p|ul|ol|li|h[1-6]|div|br|span|b|i|strong|em)[\s\S]*>/i.test(text)) {
        return text;
    }
    // Plain text: split by newlines and wrap in paragraphs
    return text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => `<p>${line}</p>`)
        .join("");
}
