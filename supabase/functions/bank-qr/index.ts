// Cobro con QR dinámico de Banco Económico (migración 20261007120000_bank_qr). Copia adaptada de la
// Edge Function de Inventia para un solo negocio: cualquier usuario con sesión puede usarla (en este
// sistema todos los usuarios tienen acceso total).
// Acciones (POST { action, ... }): configure / verify / set-enabled / remove / generate / check / cancel.
// Las credenciales del banco solo se leen aquí, con service_role; nunca vuelven al navegador.
// La venta y el descuento de stock se registran SOLO cuando el banco confirma el pago
// (fn_register_qr_payment, idempotente); el monto del QR lo calcula el servidor a partir de la venta.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BANECO_CERTIFICATION_URL,
  BANECO_PRODUCTION_URL,
  BankError,
  bankAmount,
  createBanecoClient,
  qrDueDate,
  tokenExpiresAt,
  type BanecoClient,
} from "../_shared/baneco.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

class UserError extends Error {}

type Provider = {
  environment: "certification" | "production";
  enabled: boolean;
  username: string;
  password_encrypted: string;
  aes_key: string;
  account_encrypted: string;
  account_last4: string;
  currency: "BOB" | "USD";
  branch_code: string | null;
  token: string | null;
  token_expires_at: string | null;
};

type Payment = Record<string, unknown> & {
  id: string;
  qr_id: string | null;
  status: string;
  environment: string;
  kind: string | null;
  registered_at: string | null;
};

const PUBLIC_PAYMENT_FIELDS =
  "id,kind,qr_id,amount,currency,description,due_date,status,error_message,payer_name,payer_bank_code,payer_account,bank_transaction_id,paid_at,sale_id,wholesale_order_id,registered_at,register_error,created_at";

const SALE_INVOICE_TYPES = ["SIN_FACTURA_QR", "FACTURA_QR"];
const WHOLESALE_INVOICE_TYPES = ["MAYOR_SIN_FACTURA_QR", "MAYOR_FACTURA_QR"];

function baseUrl(environment: string) {
  if (environment === "production") return Deno.env.get("BANECO_PRODUCTION_URL") ?? BANECO_PRODUCTION_URL;
  return Deno.env.get("BANECO_CERTIFICATION_URL") ?? BANECO_CERTIFICATION_URL;
}

async function loadProvider(admin: SupabaseClient) {
  const { data, error } = await admin.from("payment_providers").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) throw new UserError("El cobro con QR del banco no está configurado.");
  return data as Provider;
}

/** Token vigente del banco: reutiliza el guardado y lo renueva un minuto antes de que venza. */
async function bankToken(admin: SupabaseClient, bank: BanecoClient, provider: Provider, renew = false) {
  if (!renew && provider.token && provider.token_expires_at) {
    if (new Date(provider.token_expires_at).getTime() - Date.now() > 60_000) return provider.token;
  }
  const token = await bank.authenticate(provider.username, provider.password_encrypted);
  const expires = tokenExpiresAt(token).toISOString();
  await admin.from("payment_providers").update({ token, token_expires_at: expires }).eq("id", 1);
  provider.token = token;
  provider.token_expires_at = expires;
  return token;
}

/** Ejecuta una llamada con token; si el banco lo rechaza por vencido, renueva una vez y reintenta. */
async function withToken<T>(
  admin: SupabaseClient,
  bank: BanecoClient,
  provider: Provider,
  task: (token: string) => Promise<T>,
) {
  try {
    return await task(await bankToken(admin, bank, provider));
  } catch (reason) {
    if (reason instanceof BankError && (reason.status === 401 || reason.status === 403))
      return task(await bankToken(admin, bank, provider, true));
    throw reason;
  }
}

async function loadPayment(admin: SupabaseClient, paymentId: string) {
  if (!UUID.test(paymentId)) throw new UserError("El cobro QR no existe.");
  const { data, error } = await admin
    .from("qr_payments")
    .select(`${PUBLIC_PAYMENT_FIELDS},environment`)
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new UserError("El cobro QR no existe.");
  return data as Payment;
}

/** Guarda lo que dijo el banco (pagado o anulado) si el cobro seguía pendiente y devuelve cómo quedó. */
async function settle(
  admin: SupabaseClient,
  paymentId: string,
  status: Awaited<ReturnType<BanecoClient["qrStatus"]>>,
) {
  const paid = status.payments[0];
  const update =
    status.code === 1
      ? {
          status: "paid",
          payer_name: paid?.senderName ?? null,
          payer_bank_code: paid?.senderBankCode ?? null,
          payer_account: paid?.senderAccount ?? null,
          bank_transaction_id: paid?.transactionId ?? null,
          paid_at: paid?.paymentDate
            ? `${paid.paymentDate.slice(0, 10)}T${paid.paymentTime ?? "00:00:00"}-04:00`
            : new Date().toISOString(),
        }
      : { status: "cancelled" };
  const { error } = await admin
    .from("qr_payments")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "pending");
  if (error) throw error;
  return loadPayment(admin, paymentId);
}

/** Si el cobro está pagado y su venta aún no se registró, la registra (idempotente) y devuelve cómo quedó. */
async function registerIfPaid(admin: SupabaseClient, payment: Payment) {
  if (payment.status !== "paid" || !payment.kind || payment.registered_at) return payment;
  const { error } = await admin.rpc("fn_register_qr_payment", { p_payment_id: payment.id });
  // Un fallo de la base no debe ocultar que el pago llegó: se informa en register_error y se reintenta.
  if (error) {
    console.error(error);
    await admin
      .from("qr_payments")
      .update({ register_error: error.message.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .is("registered_at", null);
  }
  return loadPayment(admin, payment.id);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max: number) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function positiveInt(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new UserError(`${label} inválido.`);
  return number;
}

function price(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new UserError("El precio debe ser mayor a cero.");
  return Math.round(number * 100) / 100;
}

type Line = { part_id: number; quantity: number; unit_price: number };

/** Comprueba que cada producto existe y tiene stock antes de cobrar; devuelve los códigos para la glosa. */
async function checkStock(admin: SupabaseClient, lines: Line[]) {
  const ids = [...new Set(lines.map((line) => line.part_id))];
  const { data, error } = await admin.from("parts").select("id,stock,codigo_producto,name").in("id", ids);
  if (error) throw error;
  const parts = new Map((data ?? []).map((part) => [Number(part.id), part]));
  const wanted = new Map<number, number>();
  for (const line of lines) wanted.set(line.part_id, (wanted.get(line.part_id) ?? 0) + line.quantity);
  for (const [id, quantity] of wanted) {
    const part = parts.get(id);
    if (!part) throw new UserError(`Producto ${id} no encontrado.`);
    if (Number(part.stock) < quantity)
      throw new UserError(
        `Stock insuficiente para "${part.codigo_producto || part.name}". Disponible: ${part.stock}. No se generó el QR.`,
      );
  }
  return parts;
}

/** Arma la venta a registrar tras el pago y el monto exacto del QR, validados en el servidor. */
async function chargeFor(admin: SupabaseClient, body: Record<string, unknown>) {
  const kind = body.kind;
  const raw = (body.payload ?? {}) as Record<string, unknown>;

  if (kind === "sale") {
    const line = {
      part_id: positiveInt(raw.part_id, "Producto"),
      quantity: positiveInt(raw.quantity, "Cantidad"),
      unit_price: price(raw.unit_price),
    };
    const invoiceType = String(raw.invoice_type ?? "");
    if (!SALE_INVOICE_TYPES.includes(invoiceType)) throw new UserError("Tipo de venta inválido para cobro QR.");
    const parts = await checkStock(admin, [line]);
    const part = parts.get(line.part_id)!;
    return {
      kind,
      payload: { ...line, invoice_type: invoiceType },
      amount: bankAmount(line.quantity * line.unit_price),
      description: text(`Venta ${line.quantity} x ${part.codigo_producto || part.name}`, 120),
    };
  }

  if (kind === "wholesale") {
    const cliente = text(raw.cliente, 120);
    if (!cliente) throw new UserError("Falta el nombre del cliente.");
    const items = Array.isArray(raw.items) ? raw.items : [];
    if (items.length === 0 || items.length > 300) throw new UserError("El pedido no tiene productos válidos.");
    const lines = items.map((item) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        part_id: positiveInt(value.part_id, "Producto"),
        quantity: positiveInt(value.quantity, "Cantidad"),
        unit_price: price(value.unit_price),
      };
    });
    const invoiceType = String(raw.invoice_type ?? "");
    if (!WHOLESALE_INVOICE_TYPES.includes(invoiceType)) throw new UserError("Tipo de venta inválido para cobro QR.");
    await checkStock(admin, lines);
    const total = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
    return {
      kind,
      payload: { cliente, items: lines, invoice_type: invoiceType, notes: text(raw.notes, 500) },
      amount: bankAmount(total),
      description: text(`Venta por mayor - ${cliente}`, 120),
    };
  }

  // Cobro de prueba desde Mantenimiento: no registra ninguna venta.
  return { kind: null, payload: null, amount: bankAmount(Number(body.amount)), description: "Prueba de cobro QR" };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response({ error: "method not allowed" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization || !url || !anon || !service) throw new Error("server configuration missing");

    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, service);
    const { data: auth, error: authError } = await caller.auth.getUser();
    if (authError || !auth.user) throw new UserError("Tu sesión venció. Vuelve a iniciar sesión.");

    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    switch (action) {
      case "configure": {
        const environment = body.environment === "production" ? "production" : "certification";
        const username = text(body.username, 80);
        const password = String(body.password ?? "");
        const aesKey = text(body.aesKey, 128);
        const account = String(body.account ?? "").replace(/[\s.-]/g, "");
        const currency = body.currency === "USD" ? "USD" : "BOB";
        const branchCode = text(body.branchCode, 5) || null;
        if (!username || !password || !aesKey) throw new UserError("Completa usuario, contraseña y llave AES.");
        if (!/^\d{6,20}$/.test(account)) throw new UserError("El número de cuenta debe tener solo dígitos.");

        const bank = createBanecoClient(baseUrl(environment));
        const passwordEncrypted = await bank.encrypt(password, aesKey);
        const accountEncrypted = await bank.encrypt(account, aesKey);
        // Solo se guarda si el banco acepta las credenciales.
        const token = await bank.authenticate(username, passwordEncrypted);
        const now = new Date().toISOString();
        const { error } = await admin.from("payment_providers").upsert({
          id: 1,
          provider: "baneco",
          environment,
          enabled: true,
          username,
          password_encrypted: passwordEncrypted,
          aes_key: aesKey,
          account_encrypted: accountEncrypted,
          account_last4: account.slice(-4),
          currency,
          branch_code: branchCode,
          token,
          token_expires_at: tokenExpiresAt(token).toISOString(),
          verified_at: now,
          updated_by: auth.user.id,
          updated_at: now,
        });
        if (error) throw error;
        return response({ ok: true, verifiedAt: now });
      }

      case "verify": {
        const provider = await loadProvider(admin);
        const bank = createBanecoClient(baseUrl(provider.environment));
        await bankToken(admin, bank, provider, true);
        const now = new Date().toISOString();
        await admin.from("payment_providers").update({ verified_at: now }).eq("id", 1);
        return response({ ok: true, verifiedAt: now });
      }

      case "set-enabled": {
        await loadProvider(admin);
        const { error } = await admin
          .from("payment_providers")
          .update({ enabled: body.enabled === true, updated_by: auth.user.id, updated_at: new Date().toISOString() })
          .eq("id", 1);
        if (error) throw error;
        return response({ ok: true });
      }

      case "remove": {
        const { error } = await admin.from("payment_providers").delete().eq("id", 1);
        if (error) throw error;
        return response({ ok: true });
      }

      case "generate": {
        const provider = await loadProvider(admin);
        if (!provider.enabled) throw new UserError("El cobro con QR del banco está desactivado.");
        const charge = await chargeFor(admin, body);
        const dueDate = qrDueDate();

        const { data: payment, error: insertError } = await admin
          .from("qr_payments")
          .insert({
            environment: provider.environment,
            amount: charge.amount,
            currency: provider.currency,
            description: charge.description,
            due_date: dueDate,
            kind: charge.kind,
            payload: charge.payload,
            created_by: auth.user.id,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;

        const bank = createBanecoClient(baseUrl(provider.environment));
        try {
          const qr = await withToken(admin, bank, provider, (token) =>
            bank.generateQr(token, {
              transactionId: payment.id,
              accountCredit: provider.account_encrypted,
              currency: provider.currency,
              amount: charge.amount,
              description: charge.description,
              dueDate,
              singleUse: true,
              modifyAmount: false,
              branchCode: provider.branch_code ?? undefined,
            }),
          );
          await admin
            .from("qr_payments")
            .update({ qr_id: qr.qrId, updated_at: new Date().toISOString() })
            .eq("id", payment.id);
          return response({
            paymentId: payment.id,
            qrId: qr.qrId,
            qrImage: qr.qrImage,
            amount: charge.amount,
            currency: provider.currency,
            dueDate,
          });
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : "No se pudo generar el QR.";
          await admin
            .from("qr_payments")
            .update({ status: "error", error_message: message.slice(0, 300), updated_at: new Date().toISOString() })
            .eq("id", payment.id);
          throw reason;
        }
      }

      case "check": {
        let payment = await loadPayment(admin, String(body.paymentId ?? ""));
        if (payment.status === "pending" && payment.qr_id) {
          const provider = await loadProvider(admin);
          const bank = createBanecoClient(baseUrl(payment.environment));
          const status = await withToken(admin, bank, provider, (token) => bank.qrStatus(token, payment.qr_id!));
          if (status.code !== 0) payment = await settle(admin, payment.id, status);
        }
        // También sirve de «Reintentar registrar» si el pago llegó pero la venta falló.
        return response({ payment: await registerIfPaid(admin, payment) });
      }

      case "cancel": {
        const payment = await loadPayment(admin, String(body.paymentId ?? ""));
        if (payment.status !== "pending") return response({ payment: await registerIfPaid(admin, payment) });
        if (payment.qr_id) {
          const provider = await loadProvider(admin);
          const bank = createBanecoClient(baseUrl(payment.environment));
          // Si el cliente pagó justo antes de anular, no se anula: se devuelve pagado y se registra la venta.
          const status = await withToken(admin, bank, provider, (token) => bank.qrStatus(token, payment.qr_id!));
          if (status.code !== 0)
            return response({ payment: await registerIfPaid(admin, await settle(admin, payment.id, status)) });
          await withToken(admin, bank, provider, (token) => bank.cancelQr(token, payment.qr_id!));
        }
        await admin
          .from("qr_payments")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", payment.id)
          .eq("status", "pending");
        return response({ payment: await loadPayment(admin, payment.id) });
      }

      default:
        throw new UserError("Acción inválida.");
    }
  } catch (error) {
    const known = error instanceof UserError || error instanceof BankError;
    if (!known) console.error(error);
    const message = known ? (error as Error).message : "No se pudo completar la operación con el banco.";
    return response({ error: message }, 400);
  }
});
