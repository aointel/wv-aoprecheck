import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import twilio from 'twilio';
import { supabaseAdmin } from './supabase';
import { sendEmail } from './email';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from './hardcoded-config';
import {
  buildActivityCardPayload,
  createDeliveryRecord,
  createRunRecord,
  resolveChrisRecipients,
  updateDeliveryRecord,
  updateRunRecord,
  type ActivityCardPayloadData,
} from './activity-card-report-service';
import { renderActivityCard } from './scripts/render-activity-card';

type DeliveryResult = {
  runId: number;
  outputPath?: string;
  uploadedUrl?: string;
  emailSent: number;
  mmsSent: number;
  errors: string[];
};

async function uploadCompressedCard(imagePath: string): Promise<{ localCompressedPath: string; publicUrl: string }> {
  const compressedPath = imagePath.replace(/\.png$/i, '-compressed.jpg');
  await sharp(imagePath).jpeg({ quality: 62, mozjpeg: true }).toFile(compressedPath);
  const fileBuffer = await fs.promises.readFile(compressedPath);
  const key = `hourly-reports/${path.basename(compressedPath, '.jpg')}-${Date.now()}.jpg`;
  const { error } = await supabaseAdmin.storage.from('installers').upload(key, fileBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(`Failed to upload compressed card: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('installers').getPublicUrl(key);
  if (!data?.publicUrl) throw new Error('Failed to resolve public URL for compressed card');
  return { localCompressedPath: compressedPath, publicUrl: data.publicUrl };
}

export async function runChrisHierarchyActivityCardReport(options?: {
  dryRun?: boolean;
  trigger?: string;
}): Promise<DeliveryResult> {
  const dryRun = !!options?.dryRun;
  const trigger = options?.trigger || 'manual';
  const errors: string[] = [];

  const { scope, recipients } = await resolveChrisRecipients();
  const runId = await createRunRecord(scope.scopeKey);

  try {
    const payload = await buildActivityCardPayload(scope);
    const outputPath = await renderActivityCard(undefined, payload as any);
    const { publicUrl } = await uploadCompressedCard(outputPath);

    await updateRunRecord(runId, {
      status: dryRun ? 'dry_run_completed' : 'completed',
      generatedImagePath: outputPath,
      generatedImageUrl: publicUrl,
      payload: payload,
      agentRanks: Object.fromEntries(payload.agents.map((a) => [a.name.toLowerCase(), a.rank])),
    });

    if (dryRun) {
      return { runId, outputPath, uploadedUrl: publicUrl, emailSent: 0, mmsSent: 0, errors };
    }

    let emailSent = 0;
    let mmsSent = 0;
    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    for (const recipient of recipients) {
      if (recipient.email) {
        const deliveryId = await createDeliveryRecord(runId, recipient, 'email');
        try {
          const sent = await sendEmail({
            to: recipient.email,
            subject: `AO Intelligence Activity Card (${trigger})`,
            html: `
              <div style="font-family: Arial, sans-serif;">
                <h2>AO Intelligence Activity Card</h2>
                <p>Hi ${recipient.fullName},</p>
                <p>Your latest hierarchy activity card is ready.</p>
                <p><a href="${publicUrl}">Open Image</a></p>
                <p>Generated at: ${new Date(payload.generatedAt).toLocaleString()}</p>
              </div>
            `,
          });
          if (!sent) throw new Error('Email provider returned false');
          await updateDeliveryRecord(deliveryId, { status: 'delivered' });
          emailSent++;
        } catch (e: any) {
          const msg = `email:${recipient.email} -> ${e?.message || e}`;
          errors.push(msg);
          await updateDeliveryRecord(deliveryId, { status: 'failed', errorMessage: msg });
        }
      }

      if (recipient.phone) {
        const deliveryId = await createDeliveryRecord(runId, recipient, 'mms');
        try {
          const message = await twilioClient.messages.create({
            from: TWILIO_PHONE_NUMBER,
            to: recipient.phone.startsWith('+') ? recipient.phone : `+1${recipient.phone.replace(/\D/g, '')}`,
            body: 'AO Intelligence Activity Card',
            mediaUrl: [publicUrl],
          });
          await updateDeliveryRecord(deliveryId, { status: message.status || 'sent', providerSid: message.sid });
          mmsSent++;
        } catch (e: any) {
          const msg = `mms:${recipient.phone} -> ${e?.message || e}`;
          errors.push(msg);
          await updateDeliveryRecord(deliveryId, {
            status: 'failed',
            errorMessage: msg,
            errorCode: e?.code ? String(e.code) : undefined,
          });
        }
      }
    }

    return { runId, outputPath, uploadedUrl: publicUrl, emailSent, mmsSent, errors };
  } catch (e: any) {
    await updateRunRecord(runId, { status: 'failed', errorMessage: e?.message || String(e) });
    throw e;
  }
}

export async function runChrisHierarchyDryRun(): Promise<{ runId: number; outputPath?: string; uploadedUrl?: string }> {
  const result = await runChrisHierarchyActivityCardReport({ dryRun: true, trigger: 'dry_run' });
  return { runId: result.runId, outputPath: result.outputPath, uploadedUrl: result.uploadedUrl };
}

