import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-handler';
import { withAuth } from '@/lib/api/with-auth';
import { NotFoundError } from '@/infrastructure/repositories/errors';
import { SupabaseLeadRepository } from '@/infrastructure/repositories/SupabaseLeadRepository';
import { EmailService } from '@/infrastructure/services/EmailService';

export const runtime = 'nodejs';

const SendEmailSchema = z.object({
  subject: z.string().min(1, 'El asunto es obligatorio'),
  html: z.string().min(1, 'El contenido del email es obligatorio'),
  to: z.string().email('Email inválido').optional(),
  from: z.string().optional(),
});

export const POST = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { supabase, user } = await withAuth(request);
  const body = await request.json();
  const { subject, html, to: overrideTo, from } = SendEmailSchema.parse(body);

  const repo = new SupabaseLeadRepository(supabase);
  const lead = await repo.getById(id);
  if (!lead) throw new NotFoundError('Lead no encontrado');

  const emailTo = overrideTo ?? lead.email;

  // Enviar email vía Resend
  const emailService = new EmailService();
  const result = await emailService.send({
    to: emailTo,
    subject,
    html,
    from,
  });

  // Registrar como actividad en la DB (best-effort)
  try {
    await supabase.from('activities').insert([{
      lead_id: id,
      user_id: user.id,
      type: 'EMAIL',
      title: `Email enviado: ${subject}`,
      description: JSON.stringify({
        to: emailTo,
        subject,
        html: html.slice(0, 500),
        resendId: result.id,
      }),
    }] as never);
  } catch (err) {
    console.error('Error logging email activity:', err);
  }

  return NextResponse.json(
    { success: true, id: result.id, to: emailTo, subject },
    { status: 200 }
  );
});
