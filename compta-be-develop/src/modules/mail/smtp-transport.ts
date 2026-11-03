import { createTransport, Transporter } from 'nodemailer';

export interface SmtpOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export function createSmtpTransport(options: SmtpOptions): Transporter {
  return createTransport({
    host: options.host,
    port: options.port,
    // 465 = implicit TLS; any other port upgrades with STARTTLS when the server offers it
    secure: options.port === 465,
    auth: options.username ? { user: options.username, pass: options.password ?? '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}
