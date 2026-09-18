import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, Loader2, 
  Users, DollarSign, CalendarIcon, FileText
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { DepartmentTaskBoard } from "./department-task-board";

export function FinanceWorkspace() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Data States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  
  // Form States
  const [transactionType, setTransactionType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMember, setSelectedMember] = useState("none");

  useEffect(() => {
    let channel: any;

    const initializeWorkspace = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/");

        const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
        setCurrentUser(profile);

        if (profile?.departments?.name_en !== "Finance" && profile?.role !== "admin") {
          toast.error("Access Denied: You do not have Finance clearance.");
          return navigate("/app");
        }

        await fetchData();

        channel = supabase.channel('finance-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => { fetchData(); })
          .subscribe();

      } catch (error) {
        console.error(error);
      }
    };

    initializeWorkspace();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ { data: txData }, { data: membersData } ] = await Promise.all([
        supabase.from('transactions').select('*, profiles(name)').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name').order('name', { ascending: true })
      ]);

      setTransactions(txData || []);
      setMembers(membersData || []);
    } catch (error) {
      toast.error("Failed to sync financial data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return toast.error("Please enter a valid amount.");
    if (!description.trim()) return toast.error("Description is required.");
    if (!transactionDate) return toast.error("Date is required.");

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('transactions').insert([{
        type: transactionType,
        amount: Number(amount),
        description: description.trim(),
        transaction_date: transactionDate,
        member_id: transactionType === 'income' && selectedMember !== "none" ? selectedMember : null
      }]);

      if (error) throw error;
      
      toast.success(`${transactionType === 'income' ? 'Collection' : 'Expense'} recorded successfully!`);
      setAmount("");
      setDescription("");
      setSelectedMember("none");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction record? This affects the master ledger.")) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      toast.success("Transaction removed.");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Calculations
  const incomes = transactions.filter(t => t.type === 'income');
  const expenses = transactions.filter(t => t.type === 'expense');
  
  const totalIncome = incomes.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const netBalance = totalIncome - totalExpense;

  // Green for Income, Black for Expenses (Matching your design system)
  const chartData = [
    { name: 'Income', value: totalIncome, color: '#16a34a' },
    { name: 'Expenses', value: totalExpense, color: '#000000' }
  ].filter(d => d.value > 0);

  const isFinanceHead = currentUser?.role === 'admin' || currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy';

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[30vh]"><Loader2 className="w-8 h-8 animate-spin text-green-600 mb-4" /><p className="text-gray-500 font-medium">Securing Ledger...</p></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-2">
            <Wallet className="w-8 h-8 text-green-600" /> Finance Workspace
          </h2>
          <p className="text-gray-600 font-medium mt-1">Manage church collections, track operational expenses, and monitor cash flow.</p>
        </div>
        <Badge className="bg-green-600 text-white font-bold px-4 py-2 shadow-sm border-none">
          {isFinanceHead ? 'Chief Financial Officer' : 'Finance Team'}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap w-full gap-2 mb-6 h-auto bg-green-50 p-2 rounded-xl border border-green-100 shadow-inner">
          <TabsTrigger value="overview" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Overview & Tasks</TabsTrigger>
          <TabsTrigger value="ledger" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Ledger & Transactions</TabsTrigger>
        </TabsList>

        {/* ==========================================
            TAB 1: WORKSPACE OVERVIEW & TASKS
            ========================================== */}
        <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: TASK BOARD */}
            <div className="xl:col-span-1 space-y-6">
              <DepartmentTaskBoard 
                departmentId={currentUser?.department_id} 
                currentUser={currentUser} 
                accentColor="green" 
              />
            </div>

            {/* RIGHT COLUMN: STATS & CHARTS */}
            <div className="xl:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-xl"><TrendingUp className="w-6 h-6 text-green-600" /></div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Total Collected</p>
                      <p className="text-2xl font-black text-black leading-none mt-1">AED {totalIncome.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-gray-100 rounded-xl"><TrendingDown className="w-6 h-6 text-black" /></div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Total Expenses</p>
                      <p className="text-2xl font-black text-black leading-none mt-1">AED {totalExpense.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-xl"><Wallet className="w-6 h-6 text-green-600" /></div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Net Balance</p>
                      <p className={`text-2xl font-black leading-none mt-1 ${netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        AED {netBalance.toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {chartData.length > 0 ? (
                <Card className="border-green-200 shadow-sm bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-widest text-center">Cash Flow Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[250px] pb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => `AED ${Number(value).toLocaleString()}`} 
                          contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <PieChart className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Record transactions to see cash flow.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ==========================================
            TAB 2: LEDGER & TRANSACTIONS
            ========================================== */}
        <TabsContent value="ledger" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT: ADD TRANSACTION FORM */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-green-200 shadow-sm bg-white sticky top-24">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
                    <Plus className="w-5 h-5 text-green-600" /> New Transaction
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setTransactionType("income")} 
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${transactionType === "income" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                    >
                      Collection / Income
                    </button>
                    <button 
                      onClick={() => setTransactionType("expense")} 
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${transactionType === "expense" ? "bg-black text-white shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                    >
                      Church Expense
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-black font-bold uppercase">Amount (AED)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-9 border-green-200 font-medium" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-black font-bold uppercase">Date</Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="pl-9 border-green-200" />
                    </div>
                  </div>

                  {transactionType === "income" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-black font-bold uppercase">Collected From (Optional)</Label>
                      <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="border-green-200">
                          <SelectValue placeholder="Select Member" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="none">-- Anonymous / General --</SelectItem>
                          {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs text-black font-bold uppercase">Description / Purpose</Label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Textarea 
                        placeholder={transactionType === "income" ? "e.g. Sunday Tithes" : "e.g. Venue Rental"} 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        className="pl-9 resize-none border-green-200 min-h-[80px]" 
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddTransaction} 
                    disabled={isSubmitting} 
                    className={`w-full py-6 font-bold shadow-md text-white ${transactionType === "income" ? "bg-green-600 hover:bg-green-700" : "bg-black hover:bg-gray-800"}`}
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                    Record {transactionType === "income" ? "Income" : "Expense"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: LEDGER TABLE */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-green-200 shadow-sm h-full flex flex-col min-h-[500px] bg-white">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
                    <FileText className="w-5 h-5 text-green-600" /> Master Ledger History
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 p-0 flex-1 overflow-hidden flex flex-col">
                  <div className="overflow-y-auto flex-1 p-4 space-y-3 max-h-[600px]">
                    {transactions.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">
                        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No transactions recorded yet.</p>
                      </div>
                    ) : (
                      transactions.map(tx => {
                        const txDate = new Date(tx.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const isIncome = tx.type === 'income';

                        return (
                          <div key={tx.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl hover:border-green-300 transition-colors shadow-sm group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isIncome ? "bg-green-100 text-green-600" : "bg-gray-100 text-black"}`}>
                                {isIncome ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-black truncate">{tx.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-200 text-gray-500 font-mono">
                                    {txDate}
                                  </Badge>
                                  {tx.member_id && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-200 bg-green-50 text-green-700 truncate max-w-[120px]">
                                      <Users className="w-3 h-3 mr-1 inline-block" /> {tx.profiles?.name || "Member"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 pl-2">
                              <p className={`font-black text-lg ${isIncome ? "text-green-600" : "text-black"}`}>
                                {isIncome ? "+" : "-"} AED {Number(tx.amount).toLocaleString()}
                              </p>
                              {isFinanceHead && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)} className="h-8 w-8 text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}