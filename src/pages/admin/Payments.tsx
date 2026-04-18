import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, DollarSign, TrendingUp, TrendingDown, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { NewExpenseModal } from "@/components/admin/NewExpenseModal";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date: string;
  trip_id: string;
  destination?: string;
  client_name?: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  trip_id?: string;
}

interface Trip {
  id: string;
  destination: string;
}

export default function AdminPayments() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  
  const [monthFilter, setMonthFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const fetchData = async () => {
    // Busca Parcela
    const { data: instData } = await supabase
      .from("installments")
      .select("*, trips(destination, user_id), profiles(name)")
      .order("due_date", { ascending: true });

    // Busca Despesas
    const { data: expData } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: true });

    // Busca Viagens (para filtro)
    const { data: tripData } = await supabase
      .from("trips")
      .select("id, destination")
      .order("departure_date", { ascending: false });

    if (tripData) setTrips(tripData);
    
    if (instData) {
      setInstallments(instData.map((i: any) => ({
        id: i.id,
        installment_number: i.installment_number,
        amount: i.amount,
        status: i.status,
        due_date: i.due_date,
        trip_id: i.trip_id,
        destination: i.trips?.destination,
        client_name: i.profiles?.name || "—",
      })));
    }

    if (expData) setExpenses(expData);
  };

  useEffect(() => { fetchData(); }, []);

  const markAsPaid = async (inst: Installment) => {
    await supabase.from("installments").update({ status: "pago" }).eq("id", inst.id);
    await supabase.from("payments").insert({
      trip_id: inst.trip_id,
      amount_paid: inst.amount,
    });
    toast.success("Parcela marcada como paga!");
    fetchData();
  };

  const fmt = (val: number) => `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  // Filtragem
  const filteredInstallments = useMemo(() => {
    return installments.filter(inst => {
      if (tripFilter !== "all" && inst.trip_id !== tripFilter) return false;
      
      const date = parseISO(inst.due_date);
      const now = new Date();
      if (monthFilter === "7") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 7;
      if (monthFilter === "30") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 30;
      if (monthFilter === "60") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 60;
      if (monthFilter === "90") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 90;
      if (monthFilter === "120") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 120;
      if (monthFilter !== "all" && inst.due_date.substring(0, 7) !== monthFilter && !["7", "30", "60", "90", "120"].includes(monthFilter)) return false;
      
      return true;
    });
  }, [installments, tripFilter, monthFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (tripFilter !== "all" && exp.trip_id !== tripFilter) return false;
      
      const date = parseISO(exp.date);
      const now = new Date();
      if (monthFilter === "7") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 7;
      if (monthFilter === "30") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 30;
      if (monthFilter === "60") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 60;
      if (monthFilter === "90") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 90;
      if (monthFilter === "120") return (now.getTime() - date.getTime()) / (1000 * 3600 * 24) <= 120;
      if (monthFilter !== "all" && exp.date.substring(0, 7) !== monthFilter && !["7", "30", "60", "90", "120"].includes(monthFilter)) return false;
      
      return true;
    });
  }, [expenses, tripFilter, monthFilter]);

  // Cálculos de Métricas
  const totalRevenue = filteredInstallments.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.amount), 0);
  const totalPending = filteredInstallments.filter(i => i.status !== "pago").reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = filteredExpenses.reduce((s, i) => s + Number(i.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Dados para o Gráfico (Agrupado por Mês)
  const chartData = useMemo(() => {
    const dataByMonth: Record<string, { month: string, Entradas: number, Saídas: number }> = {};
    
    // Processa Entradas (apenas parcelas pagas)
    filteredInstallments.forEach(inst => {
      if (inst.status !== "pago") return;
      const m = inst.due_date.substring(0, 7); // yyyy-MM
      if (!dataByMonth[m]) dataByMonth[m] = { month: m, Entradas: 0, Saídas: 0 };
      dataByMonth[m].Entradas += Number(inst.amount);
    });

    // Processa Saídas
    filteredExpenses.forEach(exp => {
      const m = exp.date.substring(0, 7);
      if (!dataByMonth[m]) dataByMonth[m] = { month: m, Entradas: 0, Saídas: 0 };
      dataByMonth[m].Saídas += Number(exp.amount);
    });

    return Object.values(dataByMonth).sort((a, b) => a.month.localeCompare(b.month)).map(item => ({
      ...item,
      // Formata o mês para exibição (ex: Jan/2026)
      name: format(parseISO(item.month + "-01"), "MMM/yy", { locale: ptBR }).toUpperCase()
    }));
  }, [filteredInstallments, filteredExpenses]);

  // Pega uma lista de meses únicos para o seletor de filtro (com base nas parcelas e despesas)
  const availableMonths = useMemo(() => {
    const s = new Set<string>();
    installments.forEach(i => s.add(i.due_date.substring(0, 7)));
    expenses.forEach(e => s.add(e.date.substring(0, 7)));
    return Array.from(s).sort().reverse();
  }, [installments, expenses]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground">Controle de receitas, despesas e lucros</p>
        </div>
        <Button onClick={() => setIsExpenseModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Lançar Despesa
        </Button>
      </div>

      {/* Filtros */}
      <div className="glass rounded-xl p-4 flex flex-col md:flex-row gap-4 mb-6 relative z-10">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Filtrar por Mês / Período</label>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o Período</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="120">Últimos 120 dias</SelectItem>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-2 border-t">Meses Específicos</div>
              {availableMonths.map(m => (
                <SelectItem key={m} value={m}>
                  {format(parseISO(m + "-01"), "MMMM 'de' yyyy", { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Filtrar por Viagem</label>
          <Select value={tripFilter} onValueChange={setTripFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as viagens" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">Todas as viagens</SelectItem>
              {trips.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.destination}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-0">
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-sky-500/20 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Entradas</p>
            <p className="text-xl font-black text-sky-400">{fmt(totalRevenue)}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
            <TrendingDown className="h-6 w-6 text-rose-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Saídas</p>
            <p className="text-xl font-black text-rose-400">{fmt(totalExpenses)}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <DollarSign className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Lucro Líquido</p>
            <p className="text-xl font-black text-emerald-400">{fmt(netProfit)}</p>
          </div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Lançam. Futuros</p>
            <p className="text-xl font-black text-amber-400">{fmt(totalPending)}</p>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="glass rounded-xl p-6 h-80 relative z-0">
        <h3 className="font-bold mb-4 text-muted-foreground px-2">Fluxo de Caixa (Mensal)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff50" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                formatter={(val: number) => [fmt(val), ""]}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
              <Bar dataKey="Entradas" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground pb-10">
            Sem dados para o período ou viagem selecionada.
          </div>
        )}
      </div>

      {/* Lista de Pagamentos / Parcelas */}
      <div className="glass rounded-xl overflow-hidden mt-8 relative z-0">
        <div className="p-4 border-b border-border/50 bg-background/50">
          <h2 className="font-bold">Listagem de Recebimentos / Parcelas</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Cliente</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInstallments.map((inst) => (
              <TableRow key={inst.id} className="border-border/50">
                <TableCell className="font-medium">{inst.client_name}</TableCell>
                <TableCell>{inst.destination || "—"}</TableCell>
                <TableCell>{inst.installment_number}ª</TableCell>
                <TableCell>{format(parseISO(inst.due_date), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-bold">{fmt(Number(inst.amount))}</TableCell>
                <TableCell>
                  <Badge variant={inst.status === "pago" ? "default" : "secondary"} className={inst.status === "pago" ? "bg-emerald-500/20 text-emerald-400 border-0" : "bg-amber-500/20 text-amber-400 border-0"}>
                    {inst.status === "pago" ? "✓ Pago" : "⏳ Pendente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {inst.status !== "pago" && (
                    <Button variant="ghost" size="sm" onClick={() => markAsPaid(inst)} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                      <Check className="h-4 w-4 mr-1" /> Receber
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredInstallments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma parcela encontrada para os filtros selecionados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <NewExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        onSuccess={fetchData} 
      />
    </div>
  );
}
