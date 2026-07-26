import { Resend } from 'resend';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailResult {
  id: string;
  sent: boolean;
}

export class EmailService {
  private client: Resend | null = null;

  private getClient(): Resend {
    if (!this.client) {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error('RESEND_API_KEY no está configurada');
      this.client = new Resend(key);
    }
    return this.client;
  }

  async send({ to, subject, html, from }: SendEmailParams): Promise<EmailResult> {
    const client = this.getClient();
    const sender = from ?? 'jmunoz@juancode.dev';

    const { data, error } = await client.emails.send({
      from: sender,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Resend send error:', error);
      throw new Error(error.message);
    }

    return { id: data?.id ?? 'unknown', sent: true };
  }
}

export const emailService = new EmailService();
