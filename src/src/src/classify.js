/**
 * Classifies an inbound reply into one of four buckets:
 *   INTERESTED  - wants the score/link
 *   OPT_OUT     - wants to be removed (also auto-handled by Twilio/SendGrid STOP)
 *   QUESTION    - asked something that needs an answer
 *   UNCLEAR     - can't confidently classify, route to manual review
 *
 * Keyword matching first (fast, free, predictable). Falls back to Claude
 * for anything ambiguous so you're not paying for an API call on every
 * "YES" reply.
 */

const OPT_OUT_WORDS = ["stop", "unsubscribe", "remove me", "not interested", "no thanks", "quit", "cancel"];
const INTERESTED_WORDS = ["yes", "y", "sure", "sounds good", "send it", "please send", "ok", "okay", "interested"];
const QUESTION_MARKERS = ["?", "how much", "cost", "price", "what is", "how does", "why"];

function classifyByKeyword(rawText) {
  const text = rawText.trim().toLowerCase();

  if (OPT_OUT_WORDS.some((w) => text === w || text.includes(w))) {
    return "OPT_OUT";
  }

  // Exact/near-exact short affirmatives only — avoid false-positive on
  // longer messages that happen to contain "ok" somewhere.
  if (text.length <= 20 && INTERESTED_WORDS.some((w) => text === w || text.startsWith(w))) {
    return "INTERESTED";
  }

  if (QUESTION_MARKERS.some((w) => text.includes(w))) {
    return "QUESTION";
  }

  return "UNCLEAR";
}

module.exports = { classifyByKeyword, OPT_OUT_WORDS, INTERESTED_WORDS };
