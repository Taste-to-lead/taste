import { Resend } from "resend";

let connectionSettings: any;

async function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not found in environment");
  }
  
  return {
    apiKey,
    fromEmail: fromEmail || "onboarding@resend.dev",
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    const isFreemail = fromEmail && (fromEmail.includes("@gmail.") || fromEmail.includes("@yahoo.") || fromEmail.includes("@hotmail.") || fromEmail.includes("@outlook.") || fromEmail.includes("@aol."));
    const senderEmail = (fromEmail && !isFreemail) ? fromEmail : "Taste <onboarding@resend.dev>";
    console.log(`[NotificationService] Sending from: ${senderEmail} to: ${to}`);
    const { data, error } = await client.emails.send({
      from: senderEmail,
      to: [to],
      subject,
      html: body,
    });

    if (error) {
      console.error("[NotificationService] Resend error:", error);
      const msg = (error as any).message || "Email delivery failed";
      if (msg.includes("only send testing emails")) {
        return { success: false, error: "domain_not_verified" };
      }
      return { success: false, error: msg };
    }
    console.log(`[NotificationService] Email sent via Resend: ${data?.id}`);
    return { success: true };
  } catch (error: any) {
    console.error("[NotificationService] Email send failed:", error);
    return { success: false, error: error.message || "Email service unavailable" };
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
