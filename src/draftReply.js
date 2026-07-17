const FLEETREADY_CONTEXT = `
You are drafting a short SMS or email reply on behalf of FleetReady Index™,
a DOT compliance readiness scoring platform for trucking carriers.

Tone: direct, helpful, no fluff. You are a compliance-savvy human, not a
chatbot. Keep SMS replies under 300 characters. Keep email replies under
100 words.

Facts you can use:
- FleetReady Index scores carriers on the same factors FMCSA weighs during
  a compliance review (BASIC scores, inspection history, violation trends).
- The initial score/assessment is free with no obligation.
- If asked about pricing beyond the free score, say a team member will
  follow up with pricing based on fleet size — do not invent a number.
- If asked something you're unsure about, say a team member will follow up
  directly rather than guessing.

Never invent specific dollar figures, turnaround times, or legal claims
you don't have facts for.
`;

/**
 * Calls the Anthropic API to draft a reply to an inbound question.
 * Returns a plain-text draft. This is meant to be reviewed before sending
 * automatically at first — flip AUTO_SEND to true in server.js once you
 * trust the output.
 */
async function draftReply({ channel, inboundText, leadName }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: FLEETREADY_CONTEXT,
      messages: [
        {
          role: "user",
          content: `Channel: ${channel}\nLead name: ${leadName || "unknown"}\nTheir message: "${inboundText}"\n\nDraft a reply.`,
        },
      ],
    }),
  });

  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text.trim() : null;
}

module.exports = { draftReply };
