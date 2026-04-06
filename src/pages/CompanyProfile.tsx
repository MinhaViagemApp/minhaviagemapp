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
  const { user, companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cnpj: "",
    address: "",
    phone: "",
    logo_url: "",
    pix_key: "",
  });

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    const fetchCompany = async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, cnpj, address, phone, logo_url, pix_key")
        .eq("id", companyId)
        .single();

      if (error) {
        console.error("Erro Supabase (buscar empresa):", error);
      }

      if (data) {
        setForm({
          name: data.name || "",
          cnpj: data.cnpj || "",
          address: data.address || "",
          phone: data.phone || "",
          logo_url: data.logo_url || "",
          pix_key: data.pix_key || "",
        });
      }
      setLoading(false);
    };
    fetchCompany();
  }, [companyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      const message = "Erro: usuário não autenticado.";
      console.error(message);
      toast.error(message);
      window.alert(message);
      return;
    }

    const companyName = form.name.trim();

    if (!companyName) {
      const message = "Informe o nome da empresa antes de finalizar.";
      console.error(message);
      toast.error(message);
      window.alert(message);
      return;
    }

    setSaving(true);

    try {
      if (!companyId) {
        const slugBase = (companyName || user.email?.split("@")[0] || "empresa")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase();

        const companyPayload = {
          address: form.address || null,
          cnpj: form.cnpj || null,
          logo_url: form.logo_url || null,
          name: companyName,
          phone: form.phone || null,
          pix_key: form.pix_key || null,
          slug: `${slugBase || "empresa"}-${Date.now()}`,
        };

        console.log("Payload enviado (empresa):", companyPayload);

        const { data: newCompany, error: createError } = await supabase
          .from("companies")
          .insert(companyPayload)
          .select("id")
          .single();

        if (createError) {
          console.error("Erro Supabase (empresa):", createError);
          toast.error(createError.message);
          window.alert(createError.message);
          return;
        }

        console.log("Sucesso (empresa):", newCompany);

        const membershipPayload = {
          user_id: user.id,
          company_id: newCompany.id,
        };

        console.log("Payload enviado (user_companies):", membershipPayload);

        const { error: membershipError } = await supabase.from("user_companies").insert(membershipPayload);

        if (membershipError) {
          console.error("Erro Supabase (user_companies):", membershipError);
          toast.error(membershipError.message);
          window.alert(membershipError.message);
          return;
        }

        console.log("Sucesso (user_companies):", membershipPayload);
        toast.success("Empresa criada com sucesso!");
        window.location.reload();
        return;
      }

      const payload = {
        name: companyName,
        cnpj: form.cnpj || null,
        address: form.address || null,
        phone: form.phone || null,
        logo_url: form.logo_url || null,
        pix_key: form.pix_key || null,
      };

      console.log("Payload enviado (atualizar empresa):", payload);

      const { data, error } = await supabase
        .from("companies")
        .update(payload)
        .eq("id", companyId)
        .select("id")
        .single();

      if (error) {
        console.error("Erro Supabase (atualizar empresa):", error);
        toast.error(error.message);
        window.alert(error.message);
        return;
      }

      console.log("Sucesso (atualizar empresa):", data);
      toast.success("Dados atualizados com sucesso!");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const ownerId = companyId || user?.id;

    if (!file || !ownerId) return;

    setUploading(true);

    const ext = file.name.split(".").pop() || "png";
    const filePath = `${ownerId}/logo-${Date.now()}.${ext}`;

    console.log("Payload enviado (upload logo):", {
      bucket: "logos",
      fileName: file.name,
      filePath,
      size: file.size,
      type: file.type,
    });

    const { error: uploadError } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Erro Supabase (upload logo):", uploadError);
      toast.error("Erro no upload: " + uploadError.message);
      window.alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);

    console.log("Sucesso (upload logo):", urlData);

    setForm((prev) => ({ ...prev, logo_url: urlData.publicUrl }));
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
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-contain border border-border bg-background p-1" />
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
              <Label htmlFor="name">Nome da Empresa</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Minha Agência de Viagens" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua Exemplo, 123 - Cidade/UF" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix_key" className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" />Chave PIX</Label>
              <Input id="pix_key" value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="CPF, e-mail, telefone ou chave aleatória" className="bg-secondary/50" />
              <p className="text-xs text-muted-foreground">Essa chave será exibida para os clientes no painel de pagamentos.</p>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : companyId ? "Salvar dados" : "Finalizar cadastro da empresa"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
