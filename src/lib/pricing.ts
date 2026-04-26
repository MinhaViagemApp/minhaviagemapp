import { supabase } from "@/integrations/supabase/client";

export interface PriceBreakdown {
  base: number;
  feePercent: number;
  feeAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
}

/**
 * Calcula o preço final aplicando juros (cartão/boleto) e desconto de cupom.
 * Cupom só desconta se for à vista (pix/dinheiro/1x).
 */
export function computePrice(args: {
  base: number;
  paymentMethod: string; // 'pix' | 'boleto' | 'cartao' | 'dinheiro'
  installments: number;
  creditCardFeePercent?: number;
  boletoFeePercent?: number;
  couponPercent?: number;
  couponCashOnly?: boolean;
}): PriceBreakdown {
  const {
    base,
    paymentMethod,
    installments,
    creditCardFeePercent = 0,
    boletoFeePercent = 0,
    couponPercent = 0,
    couponCashOnly = true,
  } = args;

  let feePercent = 0;
  if (paymentMethod === "cartao") feePercent = creditCardFeePercent;
  else if (paymentMethod === "boleto") feePercent = boletoFeePercent;

  const withFee = base * (1 + feePercent / 100);
  const feeAmount = withFee - base;

  const isCash =
    paymentMethod === "pix" || paymentMethod === "dinheiro" || installments === 1;
  const couponEligible = couponPercent > 0 && (!couponCashOnly || isCash);
  const discountAmount = couponEligible ? withFee * (couponPercent / 100) : 0;

  return {
    base,
    feePercent,
    feeAmount,
    discountPercent: couponEligible ? couponPercent : 0,
    discountAmount,
    total: Math.max(0, withFee - discountAmount),
  };
}

export interface ValidatedCoupon {
  code: string;
  discount_percent: number;
  cash_only: boolean;
}

/**
 * Valida cupom no banco. Retorna null + mensagem caso inválido.
 */
export async function validateCoupon(
  rawCode: string,
  paymentMethod: string,
  installments: number
): Promise<{ coupon: ValidatedCoupon | null; error?: string }> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) return { coupon: null, error: "Informe um cupom." };

  const { data, error } = await (supabase as any)
    .from("coupons")
    .select("code, discount_percent, expires_at, cash_only, active, usage_limit, usage_count")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error) return { coupon: null, error: error.message };
  if (!data) return { coupon: null, error: "Cupom não encontrado ou inativo." };

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { coupon: null, error: "Cupom expirado." };
  }

  if (data.usage_limit != null && Number(data.usage_count ?? 0) >= Number(data.usage_limit)) {
    return { coupon: null, error: "Este cupom já atingiu o limite de uso." };
  }

  const isCash = paymentMethod === "pix" || paymentMethod === "dinheiro" || installments === 1;
  if (data.cash_only && !isCash) {
    return { coupon: null, error: "Este cupom é válido apenas para pagamento à vista." };
  }

  return {
    coupon: { code: data.code, discount_percent: Number(data.discount_percent), cash_only: data.cash_only },
  };
}
