import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Users, Search, Shield, User, Activity, Trash2, History,
  X, CheckCircle, Mic, BookOpen, FileText, Loader2, Calendar
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export function SessionControl() {
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Activity Panel State
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);

  useEffect(() => {
    fetchUsers();

    // Listen for new signups in real-time
    const channel = supabase.channel('profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      // Fetch all profiles and join with their family name
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          families ( name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error("Failed to load users: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewActivity = async (user: any) => {
    setSelectedUser(user);
    setIsActivityLoading(true);
    
    try {
      // Fetch everything this user has done in the reading_progress table
      // and join it with the assignments table to get the week title
      const { data, error } = await supabase
        .from('reading_progress')
        .select(`
          *,
          assignments ( week_title, chapters, book_id )
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setUserActivity(data || []);
    } catch (error: any) {
      toast.error("Failed to load activity: " + error.message);
    } finally {
      setIsActivityLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you absolutely sure you want to delete ${userName}? This will erase their login account, progress, and history forever.`)) return;

    try {
      // Because of your secure database triggers, deleting the profile 
      // automatically cascades and deletes their Auth login as well!
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      
      toast.success(`${userName} has been permanently deleted.`);
      if (selectedUser?.id === userId) setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <Badge className="bg-purple-100 text-purple-700 border-purple-200"><Shield className="w-3 h-3 mr-1"/> Admin</Badge>;
      case 'parent': return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><User className="w-3 h-3 mr-1"/> Parent</Badge>;
      default: return <Badge className="bg-green-100 text-green-700 border-green-200"><Users className="w-3 h-3 mr-1"/> Member</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 relative">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-2xl p-6 sm:p-8 border border-green-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-green-900 flex items-center gap-2">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" /> Session Control
          </h2>
          <p className="text-green-700 font-medium mt-1">Monitor reading sessions, uploaded lessons, and user activity.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-green-100 text-center w-full sm:w-auto">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Active Users</p>
          <p className="text-2xl font-black text-green-600">{users.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- MAIN USER TABLE --- */}
        <Card className={`border-gray-200 shadow-sm transition-all duration-300 ${selectedUser ? "lg:col-span-2 hidden lg:block" : "lg:col-span-3"}`}>
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  placeholder="Search name or email..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-white">
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="parent">Parents</SelectItem>
                  <SelectItem value="member">Members</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center p-12 text-gray-500">No users found matching your search.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                    <tr>
                      <th className="px-6 py-4">User Details</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4 hidden sm:table-cell">Family</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className={`hover:bg-gray-50/50 transition-colors ${selectedUser?.id === user.id ? "bg-green-50/50 hover:bg-green-50/80" : ""}`}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{user.name}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{user.email || "No email provided"}</p>
                        </td>
                        <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                        <td className="px-6 py-4 hidden sm:table-cell text-gray-600 font-medium">
                          {user.families?.name || "—"}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={`border-gray-200 shadow-sm ${selectedUser?.id === user.id ? "bg-green-100 text-green-800 border-green-300" : "text-gray-600 hover:text-green-600 hover:border-green-200"}`}
                            onClick={() => handleViewActivity(user)}
                          >
                            <Activity className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Sessions</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- ACTIVITY SLIDE-OUT PANEL --- */}
        {selectedUser && (
          <Card className="border-green-200 shadow-lg lg:col-span-1 flex flex-col sticky top-20 h-fit max-h-[85vh] overflow-hidden animate-in slide-in-from-right-8 fade-in duration-300">
            <CardHeader className="bg-gradient-to-br from-green-600 to-green-700 p-5 text-white flex-none relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/20"
                onClick={() => setSelectedUser(null)}
              >
                <X className="w-5 h-5" />
              </Button>
              <div className="pr-8">
                <Badge className="bg-white/20 text-white border-none shadow-none mb-2 hover:bg-white/20">Session Report</Badge>
                <CardTitle className="text-xl">{selectedUser.name}</CardTitle>
                <CardDescription className="text-green-100 mt-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Joined {new Date(selectedUser.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 overflow-y-auto flex-1">
              {isActivityLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : userActivity.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <History className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">No sessions recorded yet.</p>
                  <p className="text-xs text-gray-400 mt-1">This user hasn't completed any readings or uploaded resources.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {userActivity.map((activity) => (
                    <div key={activity.id} className="p-4 sm:p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-900">{activity.assignments?.week_title || "Unknown Assignment"}</p>
                          <p className="text-xs text-gray-500">Goal: {activity.assignments?.chapters}</p>
                        </div>
                        {activity.is_completed && (
                          <Badge className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" /> Finished
                          </Badge>
                        )}
                      </div>
                      
                      {/* Show Parent Uploads if they exist */}
                      {(activity.voice_recording_url || activity.explanation_file_url) && (
                        <div className="mt-3 space-y-2 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Uploaded Resources</p>
                          {activity.voice_recording_url && (
                            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50/50 p-2 rounded-lg">
                              <Mic className="w-4 h-4 text-blue-500" /> Voice Lesson Saved
                            </div>
                          )}
                          {activity.explanation_file_url && (
                            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50/50 p-2 rounded-lg">
                              <FileText className="w-4 h-4 text-amber-500" /> Study Notes PDF Saved
                            </div>
                          )}
                        </div>
                      )}
                      
                      <p className="text-[10px] text-gray-400 mt-3 text-right">
                        Last updated: {new Date(activity.completed_at || activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}