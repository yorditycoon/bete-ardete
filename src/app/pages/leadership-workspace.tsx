import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  Building2, Users, Wallet, BookOpen, HeartHandshake, Video, 
  Calendar, Loader2, TrendingUp, CheckCircle2, BarChart3, 
  ShieldCheck, Clock, PlayCircle, Download 
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { DepartmentTaskBoard } from "./department-task-board"; 

export function LeadershipWorkspace() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- AGGREGATED DB TASK STATE ---
  const [departmentTasks, setDepartmentTasks] = useState<Record<string, any[]>>({});
  
  // High-level Metrics
  const [metrics, setMetrics] = useState({
    totalMembers: 0,
    totalFamilies: 0,
    attendanceRate: 0,
    totalIncome: 0,
    totalExpense: 0,
    activeBook: "None",
    upcomingEvents: 0
  });

  useEffect(() => {
    let channel: any;

    const initializeWorkspace = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/");

        const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
        setCurrentUser(profile);

        // Security Check: Look for Head, Executive, Secretary, or Admin
        const deptName = profile?.departments?.name_en || "";
        const deptRole = profile?.department_role || "member";
        
        const isLeadership = 
          deptName.includes("Executive") || 
          deptName.includes("Leadership") || 
          deptName.includes("Secretarial") || 
          deptRole === "head" || 
          deptRole === "deputy" || 
          deptRole === "secretary";
        
        if (!isLeadership && profile?.role !== "admin") {
          toast.error("Access Denied: Executive Leadership clearance required.");
          return navigate("/app");
        }

        await fetchGlobalMetrics(true); // Initial load with spinner

        // Listen for live updates across ALL tasks
        channel = supabase.channel('executive-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'department_tasks' }, () => { 
            fetchGlobalMetrics(false); // Silent background refresh
          })
          .subscribe();

      } catch (error) {
        console.error(error);
      }
    };

    initializeWorkspace();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  const fetchGlobalMetrics = async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const [
        memberRes,
        familyRes,
        attendanceRes,
        transactionsRes,
        bookRes,
        eventRes,
        tasksRes
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('families').select('*', { count: 'exact', head: true }),
        supabase.from('attendance').select('present'),
        supabase.from('transactions').select('amount, type'),
        supabase.from('study_books').select('title').eq('status', 'active').limit(1).maybeSingle(),
        supabase.from('events').select('*', { count: 'exact', head: true }).gte('event_date', new Date().toISOString()),
        supabase.from('department_tasks').select('*, departments(name_en)')
      ]);

      // Calculate Finances securely
      let income = 0; let expense = 0;
      transactionsRes.data?.forEach(t => {
        if (t.type === 'income') income += Number(t.amount);
        else expense += Number(t.amount);
      });

      // Calculate Attendance Rate
      let attRate = 0;
      const attData = attendanceRes.data;
      if (attData && attData.length > 0) {
        const present = attData.filter((a: any) => a.present).length;
        attRate = Math.round((present / attData.length) * 100);
      }

      setMetrics({
        totalMembers: memberRes.count || 0,
        totalFamilies: familyRes.count || 0,
        attendanceRate: attRate,
        totalIncome: income,
        totalExpense: expense,
        activeBook: bookRes.data?.title || "No Active Study",
        upcomingEvents: eventRes.count || 0
      });

      // Group DB Tasks by Department Name
      const groupedTasks: Record<string, any[]> = {};
      tasksRes.data?.forEach(task => {
        const dName = task.departments?.name_en || 'Executive';
        if (!groupedTasks[dName]) groupedTasks[dName] = [];
        groupedTasks[dName].push(task);
      });
      setDepartmentTasks(groupedTasks);

    } catch (error) {
      console.error(error);
      toast.error("Failed to load executive metrics.");
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };

  const calculateTaskHealth = (keyword: string) => {
    const deptKey = Object.keys(departmentTasks).find(k => k.toLowerCase().includes(keyword.toLowerCase()));
    const tasks = deptKey ? departmentTasks[deptKey] : [];
    if (tasks.length === 0) return 100;
    const done = tasks.filter(t => t.status === 'completed').length;
    return Math.round((done / tasks.length) * 100);
  };

  const healthData = [
    { name: 'Executive', health: calculateTaskHealth('Executive'), color: '#000000' },
    { name: 'Education', health: calculateTaskHealth('Education'), color: '#16a34a' },
    { name: 'Saturday', health: calculateTaskHealth('Saturday'), color: '#2563eb' },
    { name: 'Relations', health: calculateTaskHealth('Relation'), color: '#475569' },
    { name: 'Finance', health: calculateTaskHealth('Finance'), color: '#10b981' },
    { name: 'Media', health: calculateTaskHealth('Media'), color: '#7c3aed' }
  ];

  // --- REPORT EXPORT HANDLER ---
  const handleDownloadReport = () => {
    try {
      const csvRows = [];
      
      // 1. Header Information
      csvRows.push(["Bete Ardete - Executive Boardroom Report"]);
      csvRows.push([`Generated On: ${new Date().toLocaleDateString()}`]);
      csvRows.push([]);

      // 2. Global Metrics Section
      csvRows.push(["Global Metrics", "Value"]);
      csvRows.push(["Total Members", metrics.totalMembers]);
      csvRows.push(["Total Families", metrics.totalFamilies]);
      csvRows.push(["Average Attendance Rate", `${metrics.attendanceRate}%`]);
      csvRows.push(["Net Finances (AED)", metrics.totalIncome - metrics.totalExpense]);
      csvRows.push(["Upcoming Events", metrics.upcomingEvents]);
      csvRows.push(["Active Study Curriculum", metrics.activeBook]);
      csvRows.push([]);

      // 3. Department Health Section
      csvRows.push(["Department Name", "Task Health (%)"]);
      healthData.forEach(dept => {
        csvRows.push([dept.name, `${dept.health}%`]);
      });
      csvRows.push([]);

      // 4. Detailed Task List Section
      csvRows.push(["Department", "Task Title", "Status", "Due Date"]);
      Object.entries(departmentTasks).forEach(([deptName, tasks]) => {
        tasks.forEach((task: any) => {
          csvRows.push([
            deptName,
            `"${task.title.replace(/"/g, '""')}"`,
            task.status,
            task.due_date ? new Date(task.due_date).toLocaleDateString() : "N/A"
          ]);
        });
      });

      // Convert to Blob and Download
      const csvString = csvRows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `executive_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Executive report downloaded successfully!");
    } catch (error) {
      toast.error("Failed to generate report.");
    }
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[30vh]"><Loader2 className="w-8 h-8 animate-spin text-black mb-4" /><p className="text-gray-500 font-medium">Compiling Executive Reports...</p></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER WITH DOWNLOAD BUTTON */}
      <div className="bg-black rounded-xl p-6 sm:p-8 border border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg text-white">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            <Building2 className="w-8 h-8 text-green-500" /> Executive Boardroom
          </h2>
          <p className="text-gray-400 font-medium mt-1">High-level oversight, cross-department tracking, and analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            type="button"
            onClick={handleDownloadReport} 
            className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-md transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Report (CSV)
          </Button>
          <Badge className="bg-white/10 text-white border-gray-700 font-bold px-4 py-2 shadow-sm backdrop-blur-sm hidden sm:inline-flex">
            {currentUser?.department_role === 'head' ? 'Head of Operations' : 'Executive Team'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-green-50 p-1.5 rounded-xl mb-6 border border-green-100 shadow-inner max-w-2xl">
          <TabsTrigger value="overview" className="py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Global Reports</TabsTrigger>
          <TabsTrigger value="master_tasks" className="py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Master Task Board</TabsTrigger>
          <TabsTrigger value="exec_tasks" className="py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Boardroom Tasks</TabsTrigger>
        </TabsList>

        {/* TAB 1: GLOBAL REPORTS (METRICS) */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-green-200 shadow-sm bg-white">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <Users className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-2xl font-black text-black">{metrics.totalMembers}</p>
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Total Members</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 shadow-sm bg-white">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-2xl font-black text-black">{metrics.attendanceRate}%</p>
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Avg Attendance</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 shadow-sm bg-white">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <Wallet className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-xl font-black text-black">${(metrics.totalIncome - metrics.totalExpense).toLocaleString()}</p>
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Net Finances</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 shadow-sm bg-white">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <Calendar className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-2xl font-black text-black">{metrics.upcomingEvents}</p>
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Upcoming Events</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-bold text-black flex items-center gap-2"><BarChart3 className="w-5 h-5 text-green-600"/> Department Overviews</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-green-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-green-600" /><h4 className="font-bold text-black">Saturday Service</h4></div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between border-b border-gray-100 pb-1"><span>Operational Tasks:</span> <span className="font-bold text-black">{calculateTaskHealth('Saturday')}% Done</span></div>
                    <div className="flex justify-between pt-1"><span>Current Attendance Rate:</span> <span className="font-bold text-black">{metrics.attendanceRate}%</span></div>
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-green-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-3"><BookOpen className="w-5 h-5 text-green-600" /><h4 className="font-bold text-black">Education</h4></div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between border-b border-gray-100 pb-1"><span>Active Curriculum:</span> <span className="font-bold text-black truncate max-w-[120px]">{metrics.activeBook}</span></div>
                    <div className="flex justify-between pt-1"><span>Department Health:</span> <span className="font-bold text-black">{calculateTaskHealth('Education')}%</span></div>
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-green-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-3"><HeartHandshake className="w-5 h-5 text-green-600" /><h4 className="font-bold text-black">Relations</h4></div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between border-b border-gray-100 pb-1"><span>Total Members:</span> <span className="font-bold text-black">{metrics.totalMembers}</span></div>
                    <div className="flex justify-between pt-1"><span>Families Registered:</span> <span className="font-bold text-black">{metrics.totalFamilies}</span></div>
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-green-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 mb-3"><Video className="w-5 h-5 text-green-600" /><h4 className="font-bold text-black">Media</h4></div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between border-b border-gray-100 pb-1"><span>Department Health:</span> <span className="font-bold text-black">{calculateTaskHealth('Media')}% Done</span></div>
                    <div className="flex justify-between pt-1"><span>Shift Coverage:</span> <span className="font-bold text-black">Monitored</span></div>
                  </div>
                </div>
              </div>
            </div>

            <Card className="lg:col-span-1 border-green-200 shadow-sm flex flex-col bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-black"><ShieldCheck className="w-5 h-5 text-green-600" /> Dept Task Health</CardTitle>
                <CardDescription>Percentage of live tasks completed.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center p-0 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={healthData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0fdf4" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#000000', fontSize: 12, fontWeight: 'bold' }} width={70} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px' }} formatter={(value) => `${value}%`} />
                    <Bar dataKey="health" radius={[0, 4, 4, 0]} barSize={20}>
                      {healthData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: MASTER TASK BOARD */}
        <TabsContent value="master_tasks" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'Executive', name: 'Executive Directives', icon: Building2, color: 'text-black', bg: 'bg-gray-50', border: 'border-green-200', badgeColor: 'bg-black text-white' },
              { id: 'Education', name: 'Education', icon: BookOpen, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', badgeColor: 'bg-green-100 text-green-800' },
              { id: 'Saturday', name: 'Saturday Service', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-green-200', badgeColor: 'bg-blue-100 text-blue-800' },
              { id: 'Relation', name: 'Relations', icon: HeartHandshake, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-green-200', badgeColor: 'bg-gray-200 text-black' },
              { id: 'Finance', name: 'Finance', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-green-200', badgeColor: 'bg-emerald-100 text-emerald-800' },
              { id: 'Media', name: 'Media', icon: Video, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-green-200', badgeColor: 'bg-purple-100 text-purple-800' },
            ].map(dept => {
              const deptKey = Object.keys(departmentTasks).find(k => k.toLowerCase().includes(dept.id.toLowerCase()));
              const tasks = deptKey ? departmentTasks[deptKey] : [];
              const completedTasks = tasks.filter(t => t.status === 'completed').length;
              const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 100;

              return (
                <Card key={dept.id} className={`shadow-sm flex flex-col h-[400px] bg-white ${dept.border}`}>
                  <CardHeader className={`${dept.bg} border-b border-gray-100 pb-3 rounded-t-xl`}>
                    <div className="flex justify-between items-center">
                      <CardTitle className={`text-base flex items-center gap-2 ${dept.color}`}>
                        <dept.icon className="w-5 h-5" /> {dept.name}
                      </CardTitle>
                      <Badge variant="outline" className="bg-white font-bold">{progress}% Done</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 flex-1 overflow-y-auto space-y-3 pr-2">
                    {tasks.length === 0 ? (
                      <div className="text-center text-gray-400 mt-10">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20 text-green-600" />
                        <p className="text-sm italic">No active operations.</p>
                      </div>
                    ) : (
                      tasks.map(task => (
                        <div key={task.id} className={`flex flex-col gap-1.5 p-3 rounded-lg border text-sm ${task.status === 'completed' ? 'bg-gray-50 border-transparent opacity-60' : 'bg-white border-gray-200 shadow-sm'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <span className={`font-bold ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-black'}`}>
                              {task.title}
                            </span>
                            {task.status === 'pending' && <Clock className="w-4 h-4 text-orange-400 shrink-0" />}
                            {task.status === 'in_progress' && <PlayCircle className="w-4 h-4 text-blue-500 shrink-0" />}
                            {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-medium text-gray-400">Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border-transparent uppercase tracking-wider font-bold ${dept.badgeColor}`}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* TAB 3: BOARDROOM TASKS */}
        <TabsContent value="exec_tasks" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DepartmentTaskBoard 
              departmentId={currentUser?.department_id} 
              currentUser={currentUser} 
              accentColor="green" 
            />
            <Card className="border-green-200 shadow-sm bg-white h-fit">
              <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4">
                <CardTitle className="text-black flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-green-600" /> Leadership Directives
                </CardTitle>
                <CardDescription>Manage internal boardroom tasks.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 text-sm text-gray-600 space-y-4">
                <p>
                  Tasks created on this board are strictly assigned to members of the <strong>Executive Leadership</strong> and <strong>Secretarial</strong> teams.
                </p>
                <p>
                  Use this space to track high-level strategic goals, coordinate cross-departmental reviews, and manage executive operations. Your team's progress will automatically sync to the Master Task Board under "Executive Directives".
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}