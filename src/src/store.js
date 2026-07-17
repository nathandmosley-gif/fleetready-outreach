const Airtable = require("airtable");

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Leads";

/**
 * Finds a lead by phone or email. Expects your Airtable base to have
 * columns: Name, Phone, Email, DOT Number, Status, Last Reply, Last Reply At.
 * Adjust field names below to match your actual base.
 */
async function findLeadByContact({ phone, email }) {
  const filterParts = [];
  if (phone) filterParts.push(`{Phone} = '${phone}'`);
  if (email) filterParts.push(`{Email} = '${email}'`);
  const formula = `OR(${filterParts.join(",")})`;

  const records = await base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();

  return records[0] || null;
}

async function updateLeadStatus(recordId, { status, lastReply }) {
  return base(TABLE).update(recordId, {
    Status: status,
    "Last Reply": lastReply,
    "Last Reply At": new Date().toISOString(),
  });
}

module.exports = { findLeadByContact, updateLeadStatus };
