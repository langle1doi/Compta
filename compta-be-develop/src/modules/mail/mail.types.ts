export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}

export interface OutgoingMail extends RenderedMail {
  to: string;
}

export type MailKind = 'invitation' | 'password_reset' | 'account_locked' | 'export_ready';

export type MailEnqueueStatus = 'QUEUED' | 'SKIPPED';

export interface MailEnqueueResult {
  mailJobId: string;
  status: MailEnqueueStatus;
}
