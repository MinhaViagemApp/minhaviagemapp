import { CheckCircle2, Circle, Clock, Copy, CreditCard, FileText, QrCode, Upload, FileCheck2 } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface InstallmentItem {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: string; // pendente | pago | atrasado | cancelado
  paid_at?: string | null;
  receipt_url?: string | null;
}

interface PaymentTimelineProps {
  paymentMethod: string; // pix | boleto | cartao
  installments: InstallmentItem[];
  totalPrice: number;
  pixKey?: string;
  pixDueDate?: string | null;
  pixPaid?: boolean;
  enableUpload?: boolean;
  onReceiptUploaded?: () => void;
}

function ReceiptUpload({
  installmentId,
  receiptUrl,
  onUploaded,
}: {
  installmentId: string;
  receiptUrl?: string | null;
  onUploaded?: () => void;
}) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const openReceipt = async () => {
    if (!receiptUrl) return;
    const { data } = await supabase.storage
      .from("payment-receipts")
      .createSignedUrl(receiptUrl, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${installmentId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("installments")
        .update({
          receipt_url: path,
          receipt_uploaded_at: new Date().toISOString(),
        } as any)
        .eq("id", installmentId);
      if (dbErr) throw dbErr;

      toast.success("Comprovante enviado com sucesso!");
      onUploaded?.();
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar comprovante");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />
      {receiptUrl ? (
        <>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openReceipt}>
            <FileCheck2 className="h-3 w-3 mr-1 text-emerald-400" /> Ver comprovante
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" /> Substituir
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? "Enviando..." : "Anexar comprovante"}
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pago: { label: "Pago", cls: "border-emerald-500 text-emerald-400 bg-emerald-500/10" },
    pendente: { label: "Em aberto", cls: "border-yellow-500 text-yellow-400 bg-yellow-500/10" },
    atrasado: { label: "Atrasado", cls: "border-red-500 text-red-400 bg-red-500/10" },
    cancelado: { label: "Cancelado", cls: "border-muted text-muted-foreground bg-muted/10" },
  };
  const it = map[status] || map.pendente;
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${it.cls}`}>
      {it.label}
    </Badge>
  );
}

export function PaymentTimeline({
  paymentMethod,
  installments,
  totalPrice,
  pixKey,
  pixDueDate,
  pixPaid,
  enableUpload = false,
  onReceiptUploaded,
}: PaymentTimelineProps) {
  const today = startOfDay(new Date());
  const sorted = [...installments].sort((a, b) => a.installment_number - b.installment_number);

  // PIX - exibição simplificada (única parcela ou pagamento à vista)
  if (paymentMethod === "pix") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <QrCode className="h-4 w-4 text-primary" />
          Pagamento via Pix
        </div>
        <div className="bg-secondary/40 rounded-xl p-4 space-y-3 border border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor total</span>
            <span className="font-black text-primary">
              R$ {totalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          {pixDueDate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vencimento</span>
              <span className="font-bold">
                {format(parseISO(pixDueDate.slice(0, 10)), "dd 'de' MMM, yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge status={pixPaid ? "pago" : "pendente"} />
          </div>
          {pixKey && !pixPaid && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Chave Pix</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background/60 border border-border rounded-lg px-3 py-2 text-xs font-mono break-all">
                  {pixKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(pixKey);
                    toast.success("Chave Pix copiada!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Boleto / Cartão - timeline de parcelas
  const isCard = paymentMethod === "cartao";
  const Icon = isCard ? CreditCard : FileText;
  const title = isCard ? "Pagamento via Cartão de Crédito" : "Pagamento via Boleto";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </div>
        <div className="text-xs text-muted-foreground">
          {sorted.length}x de R${" "}
          <span className="font-bold text-foreground">
            {(totalPrice / Math.max(1, sorted.length)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>{" "}
          • Total{" "}
          <span className="font-bold text-primary">
            R$ {totalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <ol className="relative border-l-2 border-border ml-3 space-y-4">
        {sorted.map((inst) => {
          const due = parseISO(inst.due_date.slice(0, 10));
          const isPaid = inst.status === "pago";
          const isLate = !isPaid && isBefore(due, today);
          const isCurrent = !isPaid && !isLate;
          // "current" real é o primeiro pendente
          const firstPendingId = sorted.find((s) => s.status !== "pago")?.id;
          const highlight = !isPaid && inst.id === firstPendingId;

          return (
            <li key={inst.id} className="ml-5 relative">
              <span
                className={`absolute -left-[34px] top-1 flex items-center justify-center w-7 h-7 rounded-full border-2 ${
                  isPaid
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : isLate
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : highlight
                        ? "bg-primary/20 border-primary text-primary animate-pulse"
                        : "bg-secondary border-border text-muted-foreground"
                }`}
              >
                {isPaid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isLate ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </span>

              <div
                className={`rounded-xl p-3 border ${
                  highlight
                    ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border bg-secondary/30"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-bold">
                    Parcela {inst.installment_number}/{sorted.length}
                  </div>
                  <StatusBadge status={isLate ? "atrasado" : inst.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                  <span>
                    {isPaid && inst.paid_at
                      ? `Pago em ${format(parseISO(inst.paid_at.slice(0, 10)), "dd/MM/yyyy", { locale: ptBR })}`
                      : `Vence em ${format(due, "dd/MM/yyyy", { locale: ptBR })}`}
                  </span>
                  <span className="font-black text-foreground">
                    R$ {Number(inst.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {enableUpload && (
                  <ReceiptUpload
                    installmentId={inst.id}
                    receiptUrl={inst.receipt_url}
                    onUploaded={onReceiptUploaded}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
