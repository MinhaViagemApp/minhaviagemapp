import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Upload, Loader2, KeyRound } from "lucide-react";

export default function CompanyProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    business_cnpj: "",
    business_address: "",
    business_phone: "",
    business_logo_url: "",
    pix_key: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("business_name, business_cnpj, business_address, business_phone, business_logo_url, pix_key")
        .eq("id", user.id)
        .single();
      if (data) {
        setForm({
          business_name: data.business_name || "",
          business_cnpj: data.business_cnpj || "",
          business_address: data.business_address || "",
          business_phone: data.business_phone || "",
          business_logo_url: data.business_logo_url || "",
          pix_key: (data as any).pix_key || "",
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: form.business_name || null,
        business_cnpj: form.business_cnpj || null,
        business_address: form.business_address || null,
        business_phone: form.business_phone || null,
        business_logo_url: form.business_logo_url || null,
        pix_key: form.pix_key || null,
      } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); }
    else { toast.success("Dados atualizados com sucesso!"); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error("Erro no upload: " + uploadError.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    setForm((prev) => ({ ...prev, business_logo_url: urlData.publicUrl }));
    setUploading(false);
    toast.success("Logo enviada! Salve para confirmar.");
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Perfil da Empresa</h1>
        <p className="text-muted-foreground">Gerencie os dados da sua empresa</p>
      </div>

      <Card className="glass-strong">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Dados da Empresa</CardTitle>
          <CardDescription>Essas informações aparecerão nos documentos e relatórios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Logomarca</Label>
              <div className="flex items-center gap-4">
                {form.business_logo_url ? (
                  <img src={form.business_logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-contain border border-border bg-background p-1" />
                ) : (
                  <div className="h-16 w-16 rounded-xl border border-dashed border-border flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-secondary/50 text-sm hover:bg-secondary transition-colors">
                    <Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Alterar logo"}
                  </div>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_name">Nome da Empresa</Label>
              <Input id="business_name" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Minha Agência de Viagens" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_cnpj">CNPJ</Label>
              <Input id="business_cnpj" value={form.business_cnpj} onChange={(e) => setForm({ ...form, business_cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_address">Endereço</Label>
              <Input id="business_address" value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} placeholder="Rua Exemplo, 123 - Cidade/UF" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_phone">Telefone</Label>
              <Input id="business_phone" value={form.business_phone} onChange={(e) => setForm({ ...form, business_phone: e.target.value })} placeholder="(11) 99999-9999" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix_key" className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />Chave PIX</Label>
              <Input id="pix_key" value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="CPF, e-mail, telefone ou chave aleatória" className="bg-secondary/50" />
              <p className="text-xs text-muted-foreground">Essa chave será exibida para os clientes no painel de pagamentos.</p>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar dados"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
