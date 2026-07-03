import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import twilio from 'twilio';
import { HARDCODED_CONFIG } from './hardcoded-config';
import { customerFlagsFromAoiModules } from './auth-service';
import {
  CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS,
  CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY,
} from './subscription-service';

const router = Router();

// In-memory store for phone verification codes
// Key: normalized email, Value: { code, expires, phone }
const phoneVerificationCodes = new Map<string, { code: string; expires: number; phone: string }>();

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const perPage = 200;
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u: any) => String(u?.email || '').trim().toLowerCase() === normalizedEmail);
    if (match?.id) return String(match.id);
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function ensureCustomerRow(params: {
  email: string;
  associateId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  primaryMarket?: string;
  secondaryMarket?: string;
  aoiModules?: string[];
  states?: string[];
  products?: string[];
}) {
  if (!supabaseAdmin) return;
  const normalizedEmail = params.email.toLowerCase().trim();
  const firstName = (params.firstName || '').trim();
  const lastName = (params.lastName || '').trim();
  const moduleFlags = customerFlagsFromAoiModules(params.aoiModules);
  const normalizedStates = Array.isArray(params.states)
    ? [...new Set(params.states.map((s) => String(s || '').trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)))]
    : [];
  const normalizedProducts = Array.isArray(params.products)
    ? [...new Set(params.products.map((p) => String(p || '').trim()).filter(Boolean))]
    : [];

  const row: Record<string, unknown> = {
    company_email: normalizedEmail,
    personal_email: normalizedEmail,
    first_name: firstName,
    last_name: lastName,
    agent_name: `${firstName} ${lastName}`.trim() || normalizedEmail.split('@')[0],
    associate_id: Number(params.associateId),
    phone: params.phone || '+1-555-0000',
    primary_market: params.primaryMarket || '',
    secondary_market: params.secondaryMarket || '',
    market: params.primaryMarket ? [params.primaryMarket] : [],
    states: normalizedStates,
    products: normalizedProducts,
    VDPACTIVE: 'INACTIVE',
    PLUSACTIVE: moduleFlags.PLUSACTIVE,
    RECRUITACTIVE: moduleFlags.RECRUITACTIVE,
    AOICONNECT: moduleFlags.AOICONNECT,
    CCPRO: false,
  };

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id')
    .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateErr } = await supabaseAdmin.from('customers').update(row).eq('id', existing.id);
    if (updateErr && updateErr.message?.toLowerCase().includes('products')) {
      const fallback = { ...row };
      delete fallback.products;
      await supabaseAdmin.from('customers').update(fallback).eq('id', existing.id);
      return;
    }
    if (updateErr) throw updateErr;
    return;
  }

  const { error: insertErr } = await supabaseAdmin.from('customers').insert(row);
  if (insertErr && insertErr.message?.toLowerCase().includes('products')) {
    const fallback = { ...row };
    delete fallback.products;
    await supabaseAdmin.from('customers').insert(fallback);
    return;
  }
  if (insertErr) throw insertErr;
}

async function dedupeCustomersByEmailAndAssociate(params: {
  email: string;
  associateId: string;
  patch: Record<string, unknown>;
}) {
  if (!supabaseAdmin) return;
  const normalizedEmail = params.email.toLowerCase().trim();
  const assocNum = Number(params.associateId);

  const { data: candidates, error: candidateErr } = await supabaseAdmin
    .from('customers')
    .select('id, company_email, personal_email, created_at')
    .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail},associate_id.eq.${assocNum}`)
    .order('created_at', { ascending: true });

  if (candidateErr || !candidates || candidates.length === 0) return;

  const emailExact = candidates.find((c: any) =>
    [c.company_email, c.personal_email]
      .filter(Boolean)
      .map((v: string) => v.toLowerCase().trim())
      .includes(normalizedEmail)
  );
  const canonical = emailExact || candidates[0];
  if (!canonical?.id) return;

  const patch = { ...params.patch };
  const { error: patchErr } = await supabaseAdmin.from('customers').update(patch).eq('id', canonical.id);
  if (patchErr && patchErr.message?.toLowerCase().includes('products')) {
    const fallbackPatch = { ...patch };
    delete (fallbackPatch as any).products;
    await supabaseAdmin.from('customers').update(fallbackPatch).eq('id', canonical.id);
  } else if (patchErr) {
    throw patchErr;
  }

  const duplicateIds = candidates
    .map((c: any) => c.id)
    .filter((id: string) => id && id !== canonical.id);
  if (duplicateIds.length > 0) {
    await supabaseAdmin.from('customers').delete().in('id', duplicateIds);
  }
}

/**
 * POST /api/auth/provision-agent
 * Auto-creates a Supabase login for an agent using their associate ID as password.
 * No email required — uses company_email from producerlist/customers.
 * The associate ID is their discount code and their initial password.
 *
 * Body: { associateId: string }  OR  { email: string }
 *
 * Returns: { success: true, email: string, message: string }
 */
router.post('/provision-agent', async (req, res) => {
  try {
    const { associateId, email, primaryMarket, secondaryMarket, aoiModules } = req.body;

    if (!associateId && !email) {
      return res.status(400).json({ success: false, error: 'associateId or email is required' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Admin not configured' });
    }

    // 1. Look up the agent in customers/producerlist
    let agentEmail: string | null = null;
    let agentPhone: string | null = null;
    let agentAssociateId: string | null = null;
    let agentFirstName: string | null = null;
    let agentLastName: string | null = null;

    if (associateId) {
      // Look up by associate_id in customers table
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name, agent_name')
        .eq('associate_id', associateId)
        .maybeSingle();

      if (!customer) {
        // Try producerlist
        const { data: producer } = await supabaseAdmin
          .from('producerlist')
          .select('company_email, personal_email, associate_id, agent_name')
          .eq('associate_id', associateId)
          .maybeSingle();

        if (!producer) {
          return res.status(404).json({ success: false, error: 'Associate ID not found', allowManual: true });
        }
        agentEmail = producer.company_email || producer.personal_email;
        agentAssociateId = String(producer.associate_id);
        const nameParts = (producer.agent_name || '').split(' ');
        agentFirstName = nameParts[0] || null;
        agentLastName = nameParts.slice(1).join(' ') || null;
      } else {
        agentEmail = customer.company_email || customer.personal_email;
        agentAssociateId = String(customer.associate_id);
        agentFirstName = customer.first_name || (customer.agent_name || '').split(' ')[0] || null;
        agentLastName = customer.last_name || (customer.agent_name || '').split(' ').slice(1).join(' ') || null;
        agentPhone = (customer as any).phone || null;
      }
    } else {
      // Look up by email
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name, agent_name')
        .or(`company_email.eq.${email.toLowerCase()},personal_email.eq.${email.toLowerCase()}`)
        .maybeSingle();

      if (!customer || !customer.associate_id) {
        return res.status(404).json({ success: false, error: 'Email not found or no associate ID on record', allowManual: true });
      }
      agentEmail = customer.company_email || customer.personal_email;
      agentAssociateId = String(customer.associate_id);
      agentFirstName = customer.first_name || null;
      agentLastName = customer.last_name || null;
        agentPhone = (customer as any).phone || null;
    }

    if (!agentEmail || !agentAssociateId) {
      return res.status(400).json({ success: false, error: 'Could not resolve agent email or associate ID' });
    }

    const normalizedEmail = agentEmail.toLowerCase().trim();
    const password = String(agentAssociateId);

    const rawPm = typeof primaryMarket === 'string' ? primaryMarket.trim() : '';
    const rawSm = typeof secondaryMarket === 'string' ? secondaryMarket.trim() : '';
    const rawMods = Array.isArray(aoiModules)
      ? (aoiModules as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    // Ensure account creation always has a canonical customers row with array-typed market/states.
    try {
      await ensureCustomerRow({
        email: normalizedEmail,
        associateId: agentAssociateId,
        firstName: agentFirstName,
        lastName: agentLastName,
        phone: agentPhone,
        primaryMarket: rawPm,
        secondaryMarket: rawSm,
        aoiModules: rawMods,
      });
    } catch (e) {
      console.warn('⚠️ provision-agent: ensureCustomerRow failed (non-critical):', e);
    }

    const custPatch: Record<string, unknown> = {};
    if (rawPm) {
      custPatch.primary_market = rawPm;
    }
    if (rawSm) {
      custPatch.secondary_market = rawSm;
    }
    if (rawMods.length > 0) {
      Object.assign(custPatch, customerFlagsFromAoiModules(rawMods));
    }
    if (Object.keys(custPatch).length > 0) {
      try {
        await supabaseAdmin
          .from('customers')
          .update(custPatch)
          .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
        console.log(`✅ provision-agent: Updated customers row with market/modules for ${normalizedEmail}`);
      } catch (upErr) {
        console.warn('⚠️ provision-agent: customers update failed (non-critical):', upErr);
      }
    }

    // 2. Try to create Supabase user — auto-verified (no email confirmation needed)
    // If creation fails because the user already exists, that's fine — just return success.
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true, // auto-verified — no email needed
      user_metadata: {
        first_name: agentFirstName,
        last_name: agentLastName,
        associate_id: agentAssociateId,
        provisioned_by: 'auto-provision',
        ...(rawPm ? { primary_market: rawPm } : {}),
        ...(rawSm ? { secondary_market: rawSm } : {}),
        ...(rawMods.length > 0 ? { aoi_modules: rawMods } : {}),
      }
    });

    if (createError) {
      // If user already exists, that's perfectly fine — they can log in with their associate ID
      const alreadyExists =
        createError.message?.toLowerCase().includes('already been registered') ||
        createError.message?.toLowerCase().includes('already exists') ||
        createError.message?.toLowerCase().includes('user already registered');

      if (alreadyExists) {
        console.log(`provision-agent: ${normalizedEmail} already exists — resetting password`);
        try {
          // Fast path: use user_id stored in customers
          const { data: custRow } = await supabaseAdmin
            .from('customers')
            .select('user_id')
            .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
            .not('user_id', 'is', null)
            .maybeSingle();
          let uid = custRow?.user_id;
          if (!uid) {
            // Fallback: look up by email
            const { data: found } = await supabaseAdmin.auth.admin.listUsers({ email: normalizedEmail });
            uid = found?.users?.find((u: any) => (u.email || '').toLowerCase().trim() === normalizedEmail)?.id;
            if (uid) await supabaseAdmin.from('customers').update({ user_id: uid }).or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
          }
          if (uid) {
            await supabaseAdmin.auth.admin.updateUserById(uid, { password: String(agentAssociateId) });
            console.log(`provision-agent: password reset for ${normalizedEmail}`);
          }
        } catch (e) { console.warn(`provision-agent: password reset failed (non-critical):`, e); }
        return res.json({ success: true, email: normalizedEmail, alreadyExists: true, associateId: agentAssociateId });
      }

      console.error('❌ provision-agent: createUser error:', createError);
      return res.status(400).json({ success: false, error: createError.message });
    }

    console.log(`✅ provision-agent: Created new login for ${normalizedEmail} (associate_id: ${agentAssociateId})`);


    const newSupabaseUserId = createData?.user?.id;

    // Link supabase user_id into customers row
    if (newSupabaseUserId) {
      try {
        await supabaseAdmin
          .from('customers')
          .update({ user_id: newSupabaseUserId })
          .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
        console.log(`✅ provision-agent: Linked user_id to customers row`);
      } catch (linkErr) {
        console.warn('⚠️ provision-agent: Failed to link user_id (non-critical):', linkErr);
      }
    }

    // Create agent_profiles row so app works immediately (diagnostic, CCPro, etc)
    try {
      const { data: existingProfile } = await supabaseAdmin
        .from('agent_profiles')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (!existingProfile) {
        await supabaseAdmin
          .from('agent_profiles')
          .insert({
            supabase_user_id: newSupabaseUserId || null,
            email: normalizedEmail,
            first_name: agentFirstName || '',
            last_name: agentLastName || '',
            phone: agentPhone || '',
            zoom_id: '',
            zoom_password: '1',
            primary_market: rawPm,
            secondary_market: rawSm,
            created_at: new Date().toISOString(),
          });
        console.log(`✅ provision-agent: Created agent_profiles row for ${normalizedEmail}`);
      } else if (newSupabaseUserId) {
        await supabaseAdmin
          .from('agent_profiles')
          .update({ supabase_user_id: newSupabaseUserId })
          .ilike('email', normalizedEmail);
        console.log(`✅ provision-agent: Updated supabase_user_id on existing agent_profiles`);
      }
    } catch (profileErr) {
      console.warn('⚠️ provision-agent: Failed to create agent_profiles (non-critical):', profileErr);
    }

    return res.json({
      success: true,
      email: normalizedEmail,
      alreadyExists: false,
      message: 'Account created. Use your Associate ID as your password.',
      associateId: agentAssociateId,
    });

  } catch (err: any) {
    console.error('❌ provision-agent error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

router.post('/provision-agent/manual', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Admin not configured' });
    }

    const {
      email,
      emailConfirm,
      associateId,
      associateIdConfirm,
      firstName,
      lastName,
      phone,
      primaryMarket,
      secondaryMarket,
      aoiModules,
      products,
      states,
    } = req.body || {};

    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedEmailConfirm = String(emailConfirm || '').toLowerCase().trim();
    const normalizedAssociate = String(associateId || '').trim();
    const normalizedAssociateConfirm = String(associateIdConfirm || '').trim();
    const normalizedPrimaryMarket = String(primaryMarket || '').trim();
    const normalizedSecondaryMarket = String(secondaryMarket || '').trim();
    const normalizedModules = Array.isArray(aoiModules)
      ? aoiModules.filter((m: unknown): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];
    const normalizedProducts = Array.isArray(products)
      ? [...new Set(products.map((p: unknown) => String(p || '').trim()).filter(Boolean))]
      : [];
    const normalizedStates = Array.isArray(states)
      ? [...new Set(states.map((s: unknown) => String(s || '').trim().toUpperCase()).filter((s: string) => /^[A-Z]{2}$/.test(s)))]
      : [];

    if (!normalizedEmail.endsWith('@aoglobelife.com')) {
      return res.status(400).json({ success: false, error: 'Email must be an @aoglobelife.com address' });
    }
    if (normalizedEmail !== normalizedEmailConfirm) {
      return res.status(400).json({ success: false, error: 'Email entries do not match' });
    }
    if (normalizedAssociate !== normalizedAssociateConfirm) {
      return res.status(400).json({ success: false, error: 'Associate ID entries do not match' });
    }
    if (!/^23\d+$/.test(normalizedAssociate)) {
      return res.status(400).json({ success: false, error: 'Associate ID must be numeric and start with 23' });
    }
    if (!normalizedPrimaryMarket) {
      return res.status(400).json({ success: false, error: 'Primary market is required' });
    }
    if (normalizedStates.length === 0) {
      return res.status(400).json({ success: false, error: 'Select at least one state' });
    }

    const safeFirstName = String(firstName || '').trim() || normalizedEmail.split('@')[0];
    const safeLastName = String(lastName || '').trim();

    await ensureCustomerRow({
      email: normalizedEmail,
      associateId: normalizedAssociate,
      firstName: safeFirstName,
      lastName: safeLastName,
      phone: String(phone || '').trim() || null,
      primaryMarket: normalizedPrimaryMarket,
      secondaryMarket: normalizedSecondaryMarket,
      aoiModules: normalizedModules,
      states: normalizedStates,
      products: normalizedProducts,
    });

    await dedupeCustomersByEmailAndAssociate({
      email: normalizedEmail,
      associateId: normalizedAssociate,
      patch: {
        company_email: normalizedEmail,
        personal_email: normalizedEmail,
        first_name: safeFirstName,
        last_name: safeLastName,
        agent_name: `${safeFirstName} ${safeLastName}`.trim(),
        associate_id: Number(normalizedAssociate),
        primary_market: normalizedPrimaryMarket,
        secondary_market: normalizedSecondaryMarket,
        market: [normalizedPrimaryMarket],
        states: normalizedStates,
        products: normalizedProducts,
      },
    });

    let userId: string | null = null;
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: normalizedAssociate,
      email_confirm: true,
      user_metadata: {
        first_name: safeFirstName,
        last_name: safeLastName,
        associate_id: normalizedAssociate,
        primary_market: normalizedPrimaryMarket,
        secondary_market: normalizedSecondaryMarket,
        aoi_modules: normalizedModules,
      },
    });

    if (createError) {
      const alreadyExists =
        createError.message?.toLowerCase().includes('already been registered') ||
        createError.message?.toLowerCase().includes('already exists') ||
        createError.message?.toLowerCase().includes('user already registered');
      if (!alreadyExists) {
        return res.status(400).json({ success: false, error: createError.message });
      }

      const existingId = await findAuthUserIdByEmail(normalizedEmail);
      if (existingId) {
        userId = existingId;
        await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password: normalizedAssociate,
          user_metadata: {
            first_name: safeFirstName,
            last_name: safeLastName,
            associate_id: normalizedAssociate,
            primary_market: normalizedPrimaryMarket,
            secondary_market: normalizedSecondaryMarket,
            aoi_modules: normalizedModules,
          },
        });
      }
    } else {
      userId = createData?.user?.id || null;
    }

    if (userId) {
      await supabaseAdmin
        .from('customers')
        .update({ user_id: userId })
        .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
    }

    const { data: profile } = await supabaseAdmin
      .from('agent_profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!profile?.id) {
      await supabaseAdmin.from('agent_profiles').insert({
        supabase_user_id: userId,
        email: normalizedEmail,
        first_name: safeFirstName,
        last_name: safeLastName,
        phone: String(phone || '').trim() || '',
        zoom_id: '',
        zoom_password: '1',
        primary_market: normalizedPrimaryMarket,
        secondary_market: normalizedSecondaryMarket,
        created_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      email: normalizedEmail,
      associateId: normalizedAssociate,
      manual: true,
      message: 'Manual account submission saved and provisioned.',
    });
  } catch (err: any) {
    console.error('❌ manual provision-agent error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * POST /api/auth/generate-ccpro-coupons  (admin-only, manual trigger)
 * Generates Stripe coupons for all associate IDs that don't have one yet.
 * Each coupon: id = associateId, $55 off first invoice (amount_off), duration = once, max_redemptions = 1
 *
 * Body: { adminKey: string, upgradeLegacyCoupons?: boolean }
 * — set upgradeLegacyCoupons true to replace unredeemed legacy 90% coupons with $55 off (same id).
 */
router.post('/generate-ccpro-coupons', async (req, res) => {
  try {
    const { adminKey, upgradeLegacyCoupons } = req.body;
    if (adminKey !== 'aoi-admin-2024') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const Stripe = (await import('stripe')).default;
    const { HARDCODED_CONFIG } = await import('./hardcoded-config');
    if (!HARDCODED_CONFIG.STRIPE_SECRET_KEY) {
      return res.status(500).json({ success: false, error: 'Stripe not configured' });
    }
    const stripe = new Stripe(HARDCODED_CONFIG.STRIPE_SECRET_KEY, { apiVersion: '2024-09-30.acacia' } as any);

    // Associate IDs from customers and producerlist (checkout validates against both)
    let allIds: string[] = [];
    let page = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('associate_id')
        .not('associate_id', 'is', null)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (error || !data || data.length === 0) break;
      allIds = allIds.concat(data.map((r: any) => String(r.associate_id).trim()).filter(Boolean));
      if (data.length < 1000) break;
      page++;
    }

    page = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('producerlist')
        .select('associate_id')
        .not('associate_id', 'is', null)
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (error || !data || data.length === 0) break;
      allIds = allIds.concat(data.map((r: any) => String(r.associate_id).trim()).filter(Boolean));
      if (data.length < 1000) break;
      page++;
    }

    const unique = [...new Set(allIds)];
    console.log(`[generate-ccpro-coupons] Found ${unique.length} unique associate IDs`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const id of unique) {
      try {
        let mustCreate = false;
        try {
          const existing = await stripe.coupons.retrieve(id);
          if (!existing || existing.deleted) {
            mustCreate = true;
          } else {
            const isUsd55 =
              existing.amount_off === CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS &&
              (existing.currency || 'usd').toLowerCase() === CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY;
            if (isUsd55) {
              skipped++;
              continue;
            }
            if (
              upgradeLegacyCoupons === true &&
              existing.percent_off === 90 &&
              (existing.times_redeemed ?? 0) === 0
            ) {
              await stripe.coupons.del(id);
              mustCreate = true;
            } else {
              skipped++;
              console.log(
                `[generate-ccpro-coupons] Skip ${id}: existing coupon is not $${CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS / 100} off (use upgradeLegacyCoupons with unredeemed 90% coupons, or delete in Stripe)`,
              );
              continue;
            }
          }
        } catch {
          mustCreate = true;
        }

        if (!mustCreate) {
          continue;
        }

        await stripe.coupons.create({
          id: id,
          amount_off: CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS,
          currency: CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY,
          duration: 'once',
          max_redemptions: 1,
          name: `CCPro $55 off first month (Associate ${id})`,
          metadata: { associate_id: id, purpose: 'ccpro_first_month' },
        });
        created++;
      } catch (e: any) {
        console.error(`[generate-ccpro-coupons] Failed for ID ${id}:`, e.message);
        errors++;
      }
    }

    console.log(`[generate-ccpro-coupons] Done: created=${created} skipped=${skipped} errors=${errors}`);
    return res.json({ success: true, total: unique.length, created, skipped, errors });

  } catch (err: any) {
    console.error('❌ generate-ccpro-coupons error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * POST /api/auth/save-phone
 * Saves a phone number to the customer's record.
 * Body: { email: string, phone: string }
 */
router.post('/save-phone', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ success: false, error: 'email and phone are required' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Admin not configured' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Normalize phone: strip non-digits, then format with country code
    const digits = phone.replace(/\D/g, '');
    let normalizedPhone: string;
    if (digits.length === 10) {
      normalizedPhone = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      normalizedPhone = `+${digits}`;
    } else {
      normalizedPhone = digits.length > 0 ? `+${digits}` : phone;
    }

    // Look up customer by company_email or personal_email
    const { data: customer, error: lookupError } = await supabaseAdmin
      .from('customers')
      .select('id, company_email, personal_email')
      .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
      .maybeSingle();

    if (lookupError) {
      console.error('❌ save-phone lookup error:', lookupError);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }

    // Update phone column
    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({ phone: normalizedPhone })
      .eq('id', customer.id);

    if (updateError) {
      console.error('❌ save-phone update error:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to save phone' });
    }

    console.log(`✅ save-phone: Saved ${normalizedPhone} for ${normalizedEmail}`);
    return res.json({ success: true });

  } catch (err: any) {
    console.error('❌ save-phone error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * POST /api/auth/send-passcode-sms
 * Legacy endpoint name kept for compatibility.
 * Always returns the passcode on-screen and does not send SMS.
 * Body: { email: string }
 * Returns: { success: true, sent: false, showOnScreen: true, associateId: string }
 */
router.post('/send-passcode-sms', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Admin not configured' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up customer by email → get phone and associate_id
    const { data: customer, error: lookupError } = await supabaseAdmin
      .from('customers')
      .select('phone, associate_id')
      .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
      .maybeSingle();

    if (lookupError) {
      console.error('❌ send-passcode-sms lookup error:', lookupError);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (!customer || !customer.associate_id) {
      return res.status(404).json({ success: false, error: 'Email not found or no associate ID on record' });
    }

    const associateId = String(customer.associate_id).trim();
    const passcode = associateId.length >= 6 ? associateId : associateId.padEnd(6, '0');

    // Ensure the passcode shown/sent is actually active in Supabase Auth.
    let passcodeSet = false;
    try {
      const authUserId = await findAuthUserIdByEmail(normalizedEmail);
      if (authUserId) {
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: passcode });
        if (updateErr) {
          throw updateErr;
        }
        passcodeSet = true;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: passcode,
          email_confirm: true,
        });
        if (createErr) {
          throw createErr;
        }
        passcodeSet = Boolean(created?.user?.id);
      }
    } catch (setErr: any) {
      console.error('❌ send-passcode-sms: failed to set Supabase passcode:', setErr?.message || setErr);
      return res.status(500).json({ success: false, error: 'Unable to set passcode right now' });
    }

    if (!passcodeSet) {
      return res.status(500).json({ success: false, error: 'Unable to set passcode right now' });
    }

    console.log(`✅ send-passcode-sms: returning on-screen passcode for ${normalizedEmail}`);
    return res.json({
      success: true,
      sent: false,
      showOnScreen: true,
      associateId: passcode,
    });

  } catch (err: any) {
    console.error('❌ send-passcode-sms error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * POST /api/auth/send-phone-code
 * Generates a 6-digit verification code, stores it, and sends via SMS.
 * Body: { email: string, phone: string }
 */
router.post('/send-phone-code', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ success: false, error: 'email and phone are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Normalize phone to E.164
    const digits = phone.replace(/\D/g, '');
    let normalizedPhone: string;
    if (digits.length === 10) {
      normalizedPhone = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      normalizedPhone = `+${digits}`;
    } else {
      normalizedPhone = digits.length > 0 ? `+${digits}` : phone;
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Map
    phoneVerificationCodes.set(normalizedEmail, {
      code,
      expires: Date.now() + 10 * 60 * 1000,
      phone: normalizedPhone,
    });

    // Send SMS via Twilio
    const client = twilio(HARDCODED_CONFIG.TWILIO_ACCOUNT_SID, HARDCODED_CONFIG.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Your AO Intelligence verification code is: ${code}. Expires in 10 minutes.`,
      from: HARDCODED_CONFIG.TWILIO_PHONE_NUMBER,
      to: normalizedPhone,
    });

    console.log(`✅ send-phone-code: Sent code to ${normalizedPhone} for ${normalizedEmail}`);
    return res.json({ success: true });

  } catch (err: any) {
    console.error('❌ send-phone-code error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

/**
 * POST /api/auth/verify-phone-code
 * Verifies the 6-digit code and saves the phone number if valid.
 * Body: { email: string, code: string }
 */
router.post('/verify-phone-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'email and code are required' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Admin not configured' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const stored = phoneVerificationCodes.get(normalizedEmail);

    // Validate code
    if (!stored) {
      return res.json({ success: false, error: 'No verification code found. Please request a new one.' });
    }
    if (Date.now() > stored.expires) {
      phoneVerificationCodes.delete(normalizedEmail);
      return res.json({ success: false, error: 'Code has expired. Please request a new one.' });
    }
    if (stored.code !== code.trim()) {
      return res.json({ success: false, error: 'Invalid or expired code' });
    }

    // Code is valid — save phone to customers table
    const normalizedPhone = stored.phone;

    const { data: customer, error: lookupError } = await supabaseAdmin
      .from('customers')
      .select('id, company_email, personal_email')
      .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
      .maybeSingle();

    if (lookupError) {
      console.error('❌ verify-phone-code lookup error:', lookupError);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('customers')
      .update({ phone: normalizedPhone })
      .eq('id', customer.id);

    if (updateError) {
      console.error('❌ verify-phone-code update error:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to save phone' });
    }

    // Remove used code
    phoneVerificationCodes.delete(normalizedEmail);

    console.log(`✅ verify-phone-code: Verified and saved ${normalizedPhone} for ${normalizedEmail}`);
    return res.json({ success: true, verified: true });

  } catch (err: any) {
    console.error('❌ verify-phone-code error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal error' });
  }
});

export default router;
