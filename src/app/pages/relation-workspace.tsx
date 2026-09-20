import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  HeartHandshake, Plus, Trash2, Loader2, 
  Users, FolderTree, Search, Shield, ChevronDown, ChevronUp, 
  User, UserMinus, UserCheck, CheckCircle, Eye, X, GraduationCap
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { createClient } from "@supabase/supabase-js"; 
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabase"; 
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { DepartmentTaskBoard } from "./department-task-board"; 

export function RelationWorkspace() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- WORKSPACE OVERVIEW STATES ---
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0 });

  // --- DIRECTORY & FAMILY MANAGEMENT STATES ---
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [allFamilies, setAllFamilies] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Family Management Modals & Controls
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [showAssignParent, setShowAssignParent] = useState(false);
  const [showCreateParent, setShowCreateParent] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [newFamily, setNewFamily] = useState({ name: "" });
  const [newParent, setNewParent] = useState({ name: "", email: "", password: "" });
  
  // Member Detail Modal State
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  useEffect(() => {
    let channel: any;

    const initializeWorkspace = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/");

        const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
        setCurrentUser(profile);

        if (!profile?.departments?.name_en?.includes("Relation") && profile?.role !== "admin") {
          toast.error("Access Denied: Relations Department clearance required.");
          return navigate("/app");
        }

        await fetchData();

        channel = supabase.channel('relation-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { fetchData(); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'families' }, () => { fetchData(); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => { fetchData(); })
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
      const [ 
        { data: profData }, 
        { data: famData },
        { data: attData }
      ] = await Promise.all([
        supabase.from('profiles').select('*, departments(name_en), families(name)').order('name', { ascending: true }),
        supabase.from('families').select('*').order('name', { ascending: true }),
        supabase.from('attendance').select('present')
      ]);

      setAllProfiles(profData || []);
      setAllFamilies(famData || []);

      if (attData) {
        const presentCount = attData.filter(a => a.present).length;
        const absentCount = attData.filter(a => !a.present).length;
        setAttendanceStats({ present: presentCount, absent: absentCount });
      }

    } catch (error) {
      toast.error("Failed to sync relations data");
    } finally {
      setIsLoading(false);
    }
  };

  const availableParents = allProfiles.filter(u => u.role === "parent" && !u.family_id);
  const getFamilyMembers = (familyId: string) => allProfiles.filter(u => u.family_id === familyId);

  const handleCreateParent = async () => {
    if (!newParent.name || !newParent.email || !newParent.password) return toast.error("Please fill in all fields");
    if (newParent.password.length < 6) return toast.error("Password must be at least 6 characters");

    try {
      setIsSubmitting(true);
      const ghostClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { error: authError } = await ghostClient.auth.signUp({
        email: newParent.email,
        password: newParent.password,
        options: { data: { full_name: newParent.name, role: 'parent' } },
      });

      if (authError) throw authError;

      toast.success(`Account created for ${newParent.name}!`);
      setNewParent({ name: "", email: "", password: "" });
      setShowCreateParent(false);
      fetchData(); 
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignParent = async (parentId: string) => {
    if (!selectedFamilyId) return;
    try {
      const { error } = await supabase.from('profiles').update({ family_id: selectedFamilyId }).eq('id', parentId);
      if (error) throw error;

      setAllProfiles((prev) => prev.map((u) => u.id === parentId ? { ...u, family_id: selectedFamilyId } : u));
      setShowAssignParent(false);
      setSelectedFamilyId("");
      toast.success("Parent assigned!");
    } catch (error: any) { toast.error(error.message); }
  };

  const handleUnassignParent = async (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this parent from the family? They will be moved back to unassigned parents.")) return;
    try {
      const { error } = await supabase.from('profiles').update({ family_id: null }).eq('id', parentId);
      if (error) throw error;
      setAllProfiles((prev) => prev.map((u) => u.id === parentId ? { ...u, family_id: null } : u));
      toast.success("Parent unassigned successfully.");
    } catch (error: any) { toast.error(error.message); }
  };

  const handleDeleteParent = async (parentId: string, parentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to PERMANENTLY delete the account for ${parentName}? This action cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', parentId);
      if (error) throw error;
      setAllProfiles((prev) => prev.filter((u) => u.id !== parentId));
      toast.success(`${parentName}'s account has been deleted.`);
    } catch (error: any) { toast.error("Failed to delete account: " + error.message); }
  };

  const handleDeleteFamily = async (familyId: string) => {
    if (!confirm("Delete this family and unassign all members?")) return;
    try {
      const { error } = await supabase.from('families').delete().eq('id', familyId);
      if (error) throw error;
      setAllFamilies(allFamilies.filter(f => f.id !== familyId));
      setAllProfiles(allProfiles.map(u => u.family_id === familyId ? { ...u, family_id: null } : u));
      toast.success("Family removed.");
    } catch (error: any) { toast.error(error.message); }
  };

  const handleCreateFamily = async () => {
    if (!newFamily.name.trim()) return toast.error("Family name cannot be empty");
    try {
      setIsSubmitting(true);
      const { data, error } = await supabase.from('families').insert([{ name: newFamily.name.trim() }]).select().single();
      if (error) throw error;
      if (data) {
        setAllFamilies((prev) => [...prev, data]);
        setNewFamily({ name: "" });
        setShowCreateFamily(false);
        toast.success(`${data.name} registered successfully!`);
      }
    } catch (error: any) { toast.error("Failed to create family: " + error.message); } finally { setIsSubmitting(false); }
  };

  const isRelationHead = currentUser?.role === 'admin' || currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy';

  const filteredDirectory = allProfiles.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parentCount = allProfiles.filter(p => p.role === 'parent').length;
  const childCount = allProfiles.filter(p => p.role === 'member').length;
  const adminCount = allProfiles.filter(p => p.role === 'admin').length;
  const totalCommunity = allProfiles.length;
  
  const parentPct = totalCommunity > 0 ? (parentCount / totalCommunity) * 100 : 0;
  const childPct = totalCommunity > 0 ? (childCount / totalCommunity) * 100 : 0;
  const adminPct = totalCommunity > 0 ? (adminCount / totalCommunity) * 100 : 0;

  const attendanceChartData = [
    { name: 'Present', value: attendanceStats.present, color: '#16a34a' }, 
    { name: 'Absent', value: attendanceStats.absent, color: '#000000' }    
  ].filter(d => d.value > 0);

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[30vh]"><Loader2 className="w-8 h-8 animate-spin text-green-600 mb-4" /><p className="text-gray-500 font-medium">Loading Relations Console...</p></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500 px-3 sm:px-6 relative">
      
      {/* HEADER */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-green-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-3">
            <HeartHandshake className="w-8 h-8 text-green-600" /> Relations Workspace
          </h2>
          <p className="text-gray-600 font-medium text-sm sm:text-base mt-1">Manage the congregation directory, community structure, and attendance.</p>
        </div>
        <Badge className="bg-green-600 text-white font-bold px-4 py-2 shadow-sm border-none">
          {isRelationHead ? 'Relations Director' : 'Care Team'}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap w-full gap-2 mb-6 h-auto bg-green-50 p-2 rounded-2xl border border-green-100 shadow-inner">
          <TabsTrigger value="overview" className="flex-1 min-w-[120px] py-3 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm rounded-xl">Overview & Analytics</TabsTrigger>
          <TabsTrigger value="directory" className="flex-1 min-w-[120px] py-3 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm rounded-xl">Church Directory</TabsTrigger>
          <TabsTrigger value="families" className="flex-1 min-w-[120px] py-3 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm rounded-xl">Manage Families</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            
            {/* LEFT COLUMN: WEEKLY TASKS */}
            <div className="xl:col-span-1 space-y-6">
              <DepartmentTaskBoard 
                departmentId={currentUser?.department_id} 
                currentUser={currentUser} 
                accentColor="green" 
              />
            </div>

            {/* RIGHT COLUMN: QUICK STATS & CHARTS */}
            <div className="xl:col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors rounded-2xl">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 tracking-wider">Total Members</p>
                      <p className="text-3xl sm:text-4xl font-black text-black mt-1">{totalCommunity}</p>
                    </div>
                    <Users className="w-10 h-10 sm:w-12 sm:h-12 text-green-100 shrink-0" />
                  </CardContent>
                </Card>
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors rounded-2xl">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 tracking-wider">Total Families</p>
                      <p className="text-3xl sm:text-4xl font-black text-black mt-1">{allFamilies.length}</p>
                    </div>
                    <FolderTree className="w-10 h-10 sm:w-12 sm:h-12 text-green-100 shrink-0" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* DEMOGRAPHICS STACKED BAR */}
                <Card className="border-green-200 shadow-sm rounded-2xl bg-white">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Community Breakdown</p>
                      <Users className="w-5 h-5 text-green-600" />
                    </div>

                    <div className="h-3 w-full flex rounded-full overflow-hidden my-6 bg-gray-100 shadow-inner">
                      <div style={{ width: `${parentPct}%` }} className="bg-green-600 transition-all duration-1000"></div>
                      <div style={{ width: `${childPct}%` }} className="bg-black transition-all duration-1000"></div>
                      <div style={{ width: `${adminPct}%` }} className="bg-gray-400 transition-all duration-1000"></div>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-gray-600 mt-2">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-600"></div><span>{parentCount} Parents</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-black"></div><span>{childCount} Members</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div><span>{adminCount} Admins</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* GLOBAL ATTENDANCE PIE CHART */}
                <Card className="border-green-200 shadow-sm rounded-2xl flex flex-col bg-white">
                  <CardHeader className="pb-0 pt-6 px-6">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Global Attendance</p>
                      <CheckCircle className="w-5 h-5 text-black" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col items-center justify-center p-6 h-[220px]">
                    {attendanceChartData.length === 0 ? (
                      <div className="text-gray-400 italic text-sm">No attendance records found</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={attendanceChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                            {attendanceChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#000000', fontWeight: 'bold' }} />
                          <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '500', color: '#4b5563' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

          </div>
        </TabsContent>

        {/* TAB 2: CHURCH DIRECTORY */}
        <TabsContent value="directory" className="space-y-6">
          <Card className="border-green-200 shadow-sm flex flex-col h-[70vh] bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4 sm:p-6 flex-none">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <CardTitle className="text-lg sm:text-xl flex items-center gap-2 text-black">
                  <Users className="w-5 h-5 text-green-600" /> Congregation Directory
                </CardTitle>
                <div className="relative w-full sm:w-[320px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Search member by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 border-green-200 focus-visible:ring-green-500 rounded-xl" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white sticky top-0 border-b border-gray-100 shadow-sm z-10">
                    <tr>
                      <th className="p-4 sm:p-5 font-bold uppercase text-gray-500 tracking-wider text-xs">Member</th>
                      <th className="p-4 sm:p-5 font-bold uppercase text-gray-500 tracking-wider text-xs">Family</th>
                      <th className="p-4 sm:p-5 font-bold uppercase text-gray-500 tracking-wider text-xs">Role & Department</th>
                      <th className="p-4 sm:p-5 font-bold uppercase text-gray-500 tracking-wider text-xs text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {filteredDirectory.length === 0 ? (
                      <tr><td colSpan={4} className="p-12 text-center text-gray-400 italic">No members found.</td></tr>
                    ) : (
                      filteredDirectory.map(profile => (
                        <tr key={profile.id} className="hover:bg-green-50/50 transition-colors">
                          <td className="p-4 sm:p-5">
                            <p className="font-bold text-black text-sm sm:text-base">{profile.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{profile.email}</p>
                          </td>
                          <td className="p-4 sm:p-5">
                            {profile.families ? (
                              <Badge variant="outline" className="bg-gray-50 text-gray-700 font-medium border-gray-200 rounded-lg px-2.5 py-1">
                                <FolderTree className="w-3 h-3 mr-1 text-green-600" /> {profile.families.name}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No Family Assigned</span>
                            )}
                          </td>
                          <td className="p-4 sm:p-5 space-y-1">
                            {profile.role === 'admin' ? (
                              <Badge className="bg-black text-white border-black text-[10px] rounded-md"><Shield className="w-3 h-3 mr-1"/> IT Admin</Badge>
                            ) : profile.role === 'parent' ? (
                              <Badge className="bg-green-100 text-green-900 border-green-200 text-[10px] rounded-md"><Shield className="w-3 h-3 mr-1"/> Parent</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-gray-200 rounded-md">Member / Child</Badge>
                            )}
                            <br />
                            {profile.departments && (
                              <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 mt-1 rounded-md text-[10px]">
                                {profile.departments.name_en} {profile.department_role === 'head' ? '(Head)' : ''}
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 sm:p-5 text-right space-x-2">
                            <button onClick={() => setSelectedProfile(profile)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 text-green-800 hover:bg-green-50 font-bold rounded-xl transition-colors text-xs shadow-sm">
                              <Eye className="w-3.5 h-3.5" /> View
                            </button>
                            {profile.email && (
                              <a href={`mailto:${profile.email}`} className="inline-flex items-center text-gray-700 hover:text-black font-bold transition-colors text-xs px-2.5 py-1.5 border border-gray-200 rounded-xl bg-gray-50">
                                Email
                              </a>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: FAMILIES */}
        <TabsContent value="families" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-green-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">Family & Household Management</h1>
              <p className="text-gray-500 mt-1 text-sm">Structure the community, link parents to children, and create new households.</p>
            </div>
            {isRelationHead && (
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setShowCreateParent(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-green-200 text-black rounded-xl hover:bg-green-50 transition-all font-bold shadow-sm text-sm">
                  <UserCheck className="w-4 h-4 text-green-600" /> New Parent
                </button>
                <button onClick={() => setShowCreateFamily(true)} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold shadow-sm text-sm">
                  <Plus className="w-4 h-4" /> New Family
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allFamilies.map((family) => {
              const familyMembers = getFamilyMembers(family.id);
              const parent = familyMembers.find(m => m.role === 'parent');
              const isExpanded = expandedFamilyId === family.id;

              return (
                <div key={family.id} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? "ring-2 ring-green-500 shadow-lg scale-[1.01]" : "shadow-sm border-green-200 hover:border-green-400"}`}>
                  <div onClick={() => setExpandedFamilyId(isExpanded ? null : family.id)} className="p-6 cursor-pointer select-none">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center border border-green-100 shrink-0">
                          <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-black text-black text-lg">{family.name}</h3>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">{familyMembers.length} Members total</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="text-gray-400 w-5 h-5" /> : <ChevronDown className="text-gray-400 w-5 h-5" />}
                    </div>
                  </div>

                  {!isExpanded && (
                    <div className="px-6 pb-6 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <Shield className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="font-bold text-black truncate">{parent?.name || "No Parent Assigned"}</span>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t border-gray-50 bg-gray-50/30 space-y-4">
                      <div className="space-y-2.5 pt-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Household Members</p>
                        {familyMembers.length === 0 ? (
                          <p className="text-sm text-gray-400 italic py-2">This family is currently empty.</p>
                        ) : (
                          <div className="space-y-2">
                            {familyMembers.map(member => (
                              <div key={member.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                  {member.role === 'parent' ? <Shield className="w-4 h-4 text-green-600 shrink-0" /> : <User className="w-4 h-4 text-gray-400 shrink-0" />}
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-black truncate">{member.name}</p>
                                    <p className="text-[10px] text-gray-500 font-mono capitalize">{member.role}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {isRelationHead && member.role === 'parent' && (
                                    <>
                                      <button onClick={(e) => handleUnassignParent(member.id, e)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Unassign Parent">
                                        <UserMinus className="w-4 h-4" />
                                      </button>
                                      <button onClick={(e) => handleDeleteParent(member.id, member.name, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Parent Account">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {isRelationHead && (
                        <div className="flex gap-2 pt-2">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedFamilyId(family.id); setShowAssignParent(true); }} className="flex-1 py-2.5 bg-white border border-green-200 text-green-700 rounded-xl text-xs font-bold hover:bg-green-50 transition-colors shadow-sm">
                            Assign Parent
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteFamily(family.id); }} className="p-2.5 text-red-400 hover:text-red-600 transition-colors rounded-xl hover:bg-red-50 border border-red-100" title="Delete Family">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

      </Tabs>

      {/* --- MODALS --- */}
{/* Member Details Modal (Centered with side-by-side header) */}
      {selectedProfile && (
        <div className="fixed inset-x-0 bottom-0 top-16 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[50] p-6 sm:p-12">
          
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl border border-gray-100 relative overflow-hidden flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-200">
            
            <button onClick={() => setSelectedProfile(null)} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-full transition-colors z-10">
               <X className="w-5 h-5" />
            </button>
            
            {/* Header info - NOW SIDE-BY-SIDE */}
            <div className="flex items-center gap-4 mb-6 pt-2 shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-50 border-4 border-green-100 text-green-700 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-black shadow-sm shrink-0">
                {selectedProfile.name?.charAt(0).toUpperCase() || <User className="w-6 h-6 sm:w-8 sm:h-8" />}
              </div>
              <div className="flex flex-col min-w-0 pr-6">
                <h2 className="text-xl sm:text-2xl font-black text-black leading-tight mb-1 truncate">{selectedProfile.name}</h2>
                <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{selectedProfile.email || "No email provided"}</p>
              </div>
            </div>
            
            {/* Scrollable details list */}
            <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Phone Number</p>
                  <p className="text-sm font-bold text-black">{selectedProfile.phone_number || "Not provided"}</p>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Gender</p>
                  <p className="text-sm font-bold text-black">{selectedProfile.gender || "Not specified"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Date of Birth</p>
                  <p className="text-sm font-bold text-black">{selectedProfile.date_of_birth || "Not provided"}</p>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">Baptism Name</p>
                  <p className="text-sm font-bold text-black">{selectedProfile.baptism_name || "Not provided"}</p>
                </div>
              </div>

              <div className="bg-green-50/50 p-3.5 rounded-2xl border border-green-100 flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-green-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-0.5">University / Institution</p>
                  <p className="text-sm font-black text-black truncate">{selectedProfile.university || "Not provided"}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-0.5">Emergency Contact</p>
                <p className="text-sm font-bold text-black">{selectedProfile.emergency_contact_name || "Not provided"}</p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Home Address</p>
                <p className="text-sm font-medium text-black leading-relaxed">{selectedProfile.address || "No address entered"}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Role & Department</p>
                  <p className="text-xs font-bold text-black capitalize mt-0.5">
                    {selectedProfile.role} 
                    {selectedProfile.departments ? <span className="text-green-600 block mt-0.5">{selectedProfile.departments.name_en}</span> : ''}
                  </p>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Family / Household</p>
                  <p className="text-xs font-bold text-black mt-0.5">{selectedProfile.families ? selectedProfile.families.name : "Not Assigned"}</p>
                </div>
              </div>

            </div>

            <button onClick={() => setSelectedProfile(null)} className="w-full mt-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all shadow-md shrink-0">
              Close Profile
            </button>
          </div>
        </div>
      )}
      {/* Create Parent Modal */}
      {showCreateParent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-green-100 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-black mb-2">Create Parent Account</h2>
            <p className="text-sm text-gray-500 mb-6">This will create a new login for a family head.</p>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                <input type="text" value={newParent.name} onChange={(e) => setNewParent({ ...newParent, name: e.target.value })} placeholder="John Abraham" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
                <input type="email" value={newParent.email} onChange={(e) => setNewParent({ ...newParent, email: e.target.value })} placeholder="john@church.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Secure Password</label>
                <input type="password" value={newParent.password} onChange={(e) => setNewParent({ ...newParent, password: e.target.value })} placeholder="At least 6 characters" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all text-sm font-medium" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowCreateParent(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 border border-gray-200 rounded-xl transition-all">Cancel</button>
                <button onClick={handleCreateParent} disabled={isSubmitting} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md transition-all">
                  {isSubmitting ? "Processing..." : "Create Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Parent Modal */}
      {showAssignParent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-green-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <h2 className="text-2xl font-black text-black mb-4">Assign Family Head</h2>
            <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
              {availableParents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 font-medium text-sm">No unassigned parents found.</p>
                </div>
              ) : (
                availableParents.map((parent) => (
                  <div key={parent.id} className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:border-green-300 transition-colors gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-black text-sm truncate">{parent.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{parent.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleAssignParent(parent.id)} className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-colors rounded-xl" title="Assign to Family">
                        <UserCheck className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => handleDeleteParent(parent.id, parent.name, e)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-xl" title="Delete Parent Account">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => { setShowAssignParent(false); setSelectedFamilyId(""); }} className="w-full mt-6 py-3.5 border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-all shrink-0">Close</button>
          </div>
        </div>
      )}

      {/* Create Family Modal */}
      {showCreateFamily && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-green-100 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-black mb-2">Register New Family</h2>
            <p className="text-sm text-gray-500 mb-6">Create a household group for church members.</p>
            <div className="space-y-4">
              <input type="text" value={newFamily.name} onChange={(e) => setNewFamily({ name: e.target.value })} placeholder="Family Name (e.g. The Abraham's)" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all text-black text-sm font-medium" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateFamily(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-all">Cancel</button>
                <button onClick={handleCreateFamily} disabled={isSubmitting} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md transition-all">
                  {isSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}