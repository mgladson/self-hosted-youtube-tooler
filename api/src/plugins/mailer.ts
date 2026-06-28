import fp from 'fastify-plugin';
import nodemailer from 'nodemailer';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type Mailer = {
  sendMail: (
    to: string,
    subject: string,
    html: string,
    headers?: Record<string, string>,
    attachments?: MailAttachment[],
    from?: string,
  ) => Promise<void>;
};

declare module 'fastify' {
  interface FastifyInstance {
    mailer: Mailer;
  }
}

async function mailer(fastify: FastifyInstance) {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    // Only attach auth when a username is configured. Dev (Mailpit) relays
    // unauthenticated, so an empty SMTP_USER must NOT send blank credentials —
    // some servers reject an AUTH attempt with an empty user/pass.
    ...(config.smtp.user
      ? { auth: { user: config.smtp.user, pass: config.smtp.pass } }
      : {}),
  });

  const sendMail = async (
    to: string,
    subject: string,
    html: string,
    headers?: Record<string, string>,
    attachments?: MailAttachment[],
    from?: string,
  ) => {
    await transporter.sendMail({
      from: from ?? config.smtp.from,
      to,
      subject,
      html,
      ...(headers ? { headers } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    });
  };

  fastify.decorate('mailer', { sendMail });

  fastify.addHook('onReady', async () => {
    try {
      await transporter.verify();
      fastify.log.info('SMTP connection verified');
    } catch (err) {
      fastify.log.warn({ err }, 'SMTP connection failed — emails will not send');
    }
  });

  fastify.addHook('onClose', async () => {
    transporter.close();
  });
}

export const mailerPlugin = fp(mailer, { name: 'mailer' });
