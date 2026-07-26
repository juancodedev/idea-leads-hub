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
  private client: Resend;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY no está configurada');
    this.client = new Resend(key);
  }

  async send({ to, subject, html, from }: SendEmailParams): Promise<EmailResult> {
    const sender = from ?? 'Idea Leads Hub <onboarding@resend.dev>';

    const { data, error } = await this.client.emails.send({
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
