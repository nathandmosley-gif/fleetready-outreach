require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const sgMail = require("@sendgrid/mail");

const { classifyByKeyword } = require("./classify");
const { draftReply } = require("./draftReply");
const { findLeadByContact, updateLeadStatus } = require("./store");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Set to true once you've reviewed enough AI-drafted answers to trust them
// going out unattended. Until then, QUESTION replies are logged + flagged
// for manual send instead of auto-sent.
const AUTO_SEND_AI_REPLIES = false;

const app = express();
app.use(bodyParser.urlencoded({ extended: false })); // Twilio sends form-encoded
app.use(bodyParser.json()); // SendGrid inbound parse can send multipart/JSON depending on setup

// ---------- SMS: Twilio inbound webhook ----------
// Configure this URL as the "A message comes in" webhook on your Twilio number.
app.post("/webhook/sms", async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body || "";

  try {
    await handleInboundReply({ channel: "sms", contact: { phone: from }, text: body });
  } catch (err) {
    console.error("SMS webhook error:", err);
  }

  // Twilio expects TwiML back, even if empty (we send replies via the API separately)
  res.type("text/xml").send("<Response></Response>");
});

// ---------- Email: SendGrid Inbound Parse webhook ----------
// Configure this URL under SendGrid > Settings > Inbound Parse for your reply-to domain.
app.post("/webhook/email", async (req, res) => {
  const from = req.body.from; // e.g. "John Smith <john@carrier.com>"
  const text = req.body.text || req.body.subject || "";
  const emailMatch = from && from.match(/<(.+)>/);
  const email = emailMatch ? emailMatch[1] : from;

  try {
    await handleInboundReply({ channel: "email", contact: { email }, text });
  } catch (err) {
    console.error("Email webhook error:", err);
  }

  res.sendStatus(200);
});

// ---------- Core classification + response logic ----------
async function handleInboundReply({ channel, contact, text }) {
  const bucket = classifyByKeyword(text);
  const lead = await findLeadByContact(contact).catch(() => null);
  const leadName = lead?.fields?.Name;

  console.log(`[${channel}] from ${JSON.stringify(contact)}: "${text}" -> ${bucket}`);

  switch (bucket) {
    case "OPT_OUT": {
      // Twilio/SendGrid handle STOP compliance automatically at the carrier
      // level, but we also mark it in our own store so we never re-contact
      // this lead on the OTHER channel.
      if (lead) await updateLeadStatus(lead.id, { status: "Opted Out", lastReply: text });
      break;
    }

    case "INTERESTED": {
      const link = process.env.ASSESSMENT_LINK;
      const message = `Great — here's your FleetReady score link: ${link}. Takes about 3 min.`;
      await sendReply({ channel, contact, message, subject: "Your FleetReady Index Score" });
      if (lead) await updateLeadStatus(lead.id, { status: "Interested - Link Sent", lastReply: text });
      break;
    }

    case "QUESTION": {
      const draft = await draftReply({ channel, inboundText: text, leadName });
      if (AUTO_SEND_AI_REPLIES && draft) {
        await sendReply({ channel, contact, message: draft, subject: "Re: FleetReady Index" });
        if (lead) await updateLeadStatus(lead.id, { status: "Question - AI Replied", lastReply: text });
      } else {
        // Log for manual review instead of sending blind
        console.log(`[NEEDS REVIEW] Draft reply for ${JSON.stringify(contact)}:\n${draft}`);
        if (lead) await updateLeadStatus(lead.id, { status: "Question - Needs Manual Reply", lastReply: text });
      }
      break;
    }

    default: {
      // UNCLEAR - don't guess, flag for a human
      if (lead) await updateLeadStatus(lead.id, { status: "Needs Manual Review", lastReply: text });
    }
  }
}

async function sendReply({ channel, contact, message, subject }) {
  if (channel === "sms" && contact.phone) {
    await twilioClient.messages.create({
      to: contact.phone,
      from: process.env.TWILIO_FROM_NUMBER,
      body: `${message} Reply STOP to opt out.`,
    });
  } else if (channel === "email" && contact.email) {
    await sgMail.send({
      to: contact.email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: subject || "Re: FleetReady Index",
      text: message,
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FleetReady webhook server listening on :${PORT}`));
