// Mail in e2e goes to Mailpit only (setup/env.ts): what the tests read is what was really sent over SMTP.
const base = () => `http://localhost:${process.env.MAILPIT_UI_PORT ?? 8025}/api/v1`;

export interface ReceivedMail {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
  From: { Address: string; Name: string };
  To: { Address: string }[];
}

export async function mailsTo(address: string): Promise<ReceivedMail[]> {
  const res = await fetch(`${base()}/search?query=${encodeURIComponent(`to:"${address}"`)}`);
  const { messages } = (await res.json()) as { messages: { ID: string }[] };
  return Promise.all(messages.map(async ({ ID }) => (await fetch(`${base()}/message/${ID}`)).json() as Promise<ReceivedMail>));
}

/** Newest first. Fails the test when fewer than `count` mails arrive in time. */
export async function waitForMails(address: string, count = 1, timeoutMs = 15_000): Promise<ReceivedMail[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const mails = await mailsTo(address);
    if (mails.length >= count) return mails;
    if (Date.now() > deadline) throw new Error(`Expected ${count} mail(s) to ${address}, got ${mails.length}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

export const linkIn = (mail: ReceivedMail) => {
  const match = /https?:\/\/\S+token=\S+/.exec(mail.Text);
  if (!match) throw new Error(`No link in mail: ${mail.Subject}`);
  return new URL(match[0]);
};

export const tokenIn = (mail: ReceivedMail) => linkIn(mail).searchParams.get('token')!;
