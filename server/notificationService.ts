import { Resend } from "resend";

// Resend integration via Replit connector
let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email,
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  try {
    const { client, fromEmail } = await getResendClient();
    const isVerifiedDomain = fromEmail && !fromEmail.includes("@gmail.") && !fromEmail.includes("@yahoo.") && !fromEmail.includes("@hotmail.") && !fromEmail.includes("@outlook.");
    const senderEmail = isVerifiedDomain ? fromEmail : "Taste <onboarding@resend.dev>";
    console.log(`[NotificationService] Sending from: ${senderEmail} to: ${to}`);
    const { data, error } = await client.emails.send({
      from: senderEmail,
      to: [to],
      subject,
      html: body,
    });

    if (error) {
      console.error("[NotificationService] Resend error:", error);
      return;
    }
    console.log(`[NotificationService] Email sent via Resend: ${data?.id}`);
  } catch (error) {
    console.error("[NotificationService] Email send failed:", error);
  }
}

export function buildMatchEmailHtml({
  userName,
  propertyTitle,
  propertyLocation,
  matchScore,
  matchedTags,
  price,
}: {
  userName: string;
  propertyTitle: string;
  propertyLocation: string;
  matchScore: number;
  matchedTags: string[];
  price: number;
}): string {
  const tagBadges = matchedTags.length > 0
    ? matchedTags.map(t => `<span style="display:inline-block;background:#f59e0b;color:#000;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;margin:2px;">${t}</span>`).join(" ")
    : '<span style="color:#888;">No specific tags matched</span>';

  return `
    <div style="font-family:'Playfair Display',serif,Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a2e;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px;text-align:center;">
        <h1 style="margin:0;color:#000;font-size:22px;">Taste | Hot Lead Alert</h1>
        <p style="margin:4px 0 0;color:#000;opacity:0.7;font-size:14px;">${matchScore}% Match Score</p>
      </div>
      <div style="padding:24px;color:#e2e8f0;">
        <p style="margin:0 0 8px;font-size:16px;"><strong>${userName || "A buyer"}</strong> matched with:</p>
        <h2 style="margin:0 0 4px;color:#f59e0b;font-size:20px;">${propertyTitle}</h2>
        <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;">${propertyLocation} &bull; $${price.toLocaleString()}</p>
        <div style="margin:0 0 20px;">
          <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;">Matched on:</p>
          ${tagBadges}
        </div>
        <a href="#" style="display:block;text-align:center;background:#f59e0b;color:#000;padding:12px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View Lead Details</a>
      </div>
    </div>
  `;
}
