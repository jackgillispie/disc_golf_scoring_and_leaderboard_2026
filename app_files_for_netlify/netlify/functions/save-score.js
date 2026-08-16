// netlify/functions/save-score.js
// if purchasing paid plan, use process.env to grab env variables/secrets

const AIRTABLE_TOKEN =
  "REDACTED_AIRTABLE_TOKEN";
const AIRTABLE_BASE = "app9xCLKeFxrc31bQ";
const AIRTABLE_TABLE = "tblWLOkV2zYmp4NDI";

const axios = require("axios");
exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!event.body) {
    return { statusCode: 500, body: "No event body" };
  }

  //take care to make sure this is consistent with frontend payload structure
  const { Tournament, Group, Players, Hole, Par, Score, VsPar, Timestamp } =
    JSON.parse(event.body);

  try {
    const response = await axios.post(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      {
        fields: {
          Tournament: Tournament,
          Group: Group,
          Players: Players,
          Hole: Hole,
          Par: Par,
          Score: Score,
          VsPar: VsPar,
          Timestamp: Timestamp,
        },
        typecast: true,
      },
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Score saved!", data: response.data }),
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
