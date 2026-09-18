import { useState, useEffect } from "react";
import { 
  Plus, Users, UserCheck, Trash2, ChevronDown, ChevronUp, 
  Shield, User, UserMinus, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js"; 
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabase"; 

type Family = {
  id: string;
  name: string;
  created_at: string;
};

type Profile = {
  id: string;
  name: string;
  role: string;
  family_id: string | null;
};

export function FamilyManagement() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);
  
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [showAssignParent, setShowAssignParent] = useState(false);
  const [showCreateParent, setShowCreateParent] = useState(false);
  
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [newFamily, setNewFamily] = useState({ name: "" });
  const [newParent, setNewParent] = useState({ name: "", email: "", password: "" });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [familiesResponse, profilesResponse] = await Promise.all([
        supabase.from('families').select('*').order('name'),
        supabase.from('profiles').select('*')
      ]);

      if (familiesResponse.error) throw familiesResponse.error;
      if (profilesResponse.error) throw profilesResponse.error;

      setFamilies(familiesResponse.data || []);
      setUsers(profilesResponse.data || []);
    } catch (error: any) {
      toast.error("Error loading data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const availableParents = users.filter(u => u.role === "parent" && !u.family_id);

  const getFamilyMembers = (familyId: string) => {
    return users.filter(u => u.family_id === familyId);
  };

  const handleCreateParent = async () => {
    if (!newParent.name || !newParent.email || !newParent.password) {
      toast.error("Please fill in all fields (Name, Email, Password)");
      return;
    }

    if (newParent.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 👻 THE GHOST CLIENT (Prevents Admin from being logged out)
      const ghostClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      
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
      const { error } = await supabase
        .from('profiles')
        .update({ family_id: selectedFamilyId })
        .eq('id', parentId);

      if (error) throw error;

      setUsers((prev) => prev.map((u) => u.id === parentId ? { ...u, family_id: selectedFamilyId } : u));
      setShowAssignParent(false);
      setSelectedFamilyId("");
      toast.success("Parent assigned!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUnassignParent = async (parentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this parent from the family? They will be moved back to unassigned parents.")) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ family_id: null }) 
        .eq('id', parentId);

      if (error) throw error;

      setUsers((prev) => prev.map((u) => u.id === parentId ? { ...u, family_id: null } : u));
      toast.success("Parent unassigned successfully.");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteParent = async (parentId: string, parentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to PERMANENTLY delete the account for ${parentName}? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', parentId);

      if (error) throw error;

      setUsers((prev) => prev.filter((u) => u.id !== parentId));
      toast.success(`${parentName}'s account has been deleted.`);
    } catch (error: any) {
      toast.error("Failed to delete account: " + error.message);
    }
  };

  const handleDeleteFamily = async (familyId: string) => {
    if (!confirm("Delete this family and unassign all members?")) return;
    try {
      const { error } = await supabase.from('families').delete().eq('id', familyId);
      if (error) throw error;
      setFamilies(families.filter(f => f.id !== familyId));
      setUsers(users.map(u => u.family_id === familyId ? { ...u, family_id: null } : u));
      toast.success("Family removed.");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreateFamily = async () => {
    if (!newFamily.name.trim()) {
      toast.error("Family name cannot be empty");
      return;
    }

    try {
      setIsSubmitting(true);
      const { data, error } = await supabase
        .from('families')
        .insert([{ name: newFamily.name.trim() }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setFamilies((prev) => [...prev, data]);
        setNewFamily({ name: "" });
        setShowCreateFamily(false);
        toast.success(`${data.name} registered successfully!`);
      }
    } catch (error: any) {
      toast.error("Failed to create family: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Loading Family Registry...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-green-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2">
            Family Management
          </h1>
          <p className="text-gray-600 mt-1 font-medium">Structure your community and link household heads.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowCreateParent(true)} className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-5 py-2.5 bg-white border border-green-200 text-black rounded-xl hover:bg-green-50 transition-all font-bold shadow-sm">
            <UserCheck className="w-4 h-4 text-green-600" />
            New Parent
          </button>
          <button onClick={() => setShowCreateFamily(true)} className="flex flex-1 sm:flex-none justify-center items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-all font-bold shadow-md">
            <Plus className="w-4 h-4" />
            New Family
          </button>
        </div>
      </div>

      {/* Family Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {families.map((family) => {
          const familyMembers = getFamilyMembers(family.id);
          const parent = familyMembers.find(m => m.role === 'parent');
          const isExpanded = expandedFamilyId === family.id;

          return (
            <div 
              key={family.id} 
              className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
                isExpanded ? "ring-2 ring-green-500 shadow-lg scale-[1.02]" : "shadow-sm border-gray-200 hover:border-green-400"
              }`}
            >
              <div onClick={() => setExpandedFamilyId(isExpanded ? null : family.id)} className="p-6 cursor-pointer select-none">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-black text-lg">{family.name}</h3>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                        {familyMembers.length} Members total
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                </div>
              </div>

              {!isExpanded && (
                <div className="px-6 pb-6 space-y-2">
                   <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Shield className="w-3.5 h-3.5 text-black" />
                      <span className="font-bold text-black">{parent?.name || "No Parent Assigned"}</span>
                   </div>
                </div>
              )}

              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Household Members</p>
                    {familyMembers.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">This family is currently empty.</p>
                    ) : (
                      <div className="space-y-2">
                        {familyMembers.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                              {member.role === 'parent' ? <Shield className="w-4 h-4 text-green-600" /> : <User className="w-4 h-4 text-black" />}
                              <div>
                                <p className="text-sm font-bold text-black">{member.name}</p>
                                <p className="text-[10px] text-gray-500 font-mono capitalize font-medium">{member.role}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold tracking-wider uppercase bg-gray-100 px-2 py-0.5 rounded text-gray-500 hidden sm:block">ID: {member.id.slice(0, 5)}</span>
                              
                              {/* --- Unassign and Delete Parent Buttons --- */}
                              {member.role === 'parent' && (
                                <>
                                  <button
                                    onClick={(e) => handleUnassignParent(member.id, e)}
                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                    title="Unassign Parent"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteParent(member.id, member.name, e)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Delete Parent Account"
                                  >
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

                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedFamilyId(family.id); setShowAssignParent(true); }}
                      className="flex-1 py-2 bg-white border border-green-200 text-black rounded-lg text-xs font-bold hover:bg-green-50 transition-colors shadow-sm"
                    >
                      Assign Parent
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteFamily(family.id); }}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors bg-white border border-gray-200 rounded-lg hover:bg-red-50 shadow-sm"
                      title="Delete Family"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Parent Modal */}
      {showCreateParent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-green-100">
            <h2 className="text-2xl font-bold text-black mb-2">Create Parent Account</h2>
            <p className="text-sm text-gray-500 mb-6 font-medium">This will create a new login for a family head.</p>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                <input type="text" value={newParent.name} onChange={(e) => setNewParent({ ...newParent, name: e.target.value })} placeholder="John Abraham" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none transition-all text-black font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
                <input type="email" value={newParent.email} onChange={(e) => setNewParent({ ...newParent, email: e.target.value })} placeholder="john@church.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none transition-all text-black font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Secure Password</label>
                <input type="password" value={newParent.password} onChange={(e) => setNewParent({ ...newParent, password: e.target.value })} placeholder="At least 6 characters" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none transition-all text-black font-medium" />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowCreateParent(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-50 border border-gray-200 rounded-xl transition-all">Cancel</button>
                <button onClick={handleCreateParent} disabled={isSubmitting} className="flex-1 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 shadow-md transition-all">
                  {isSubmitting ? "Processing..." : "Create Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Parent Modal */}
      {showAssignParent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-green-100">
            <h2 className="text-2xl font-bold text-black mb-6">Assign Family Head</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {availableParents.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-500 font-bold">No unassigned parents.</p>
                </div>
              ) : (
                availableParents.map((parent) => (
                  <div key={parent.id} className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:border-green-300 transition-colors">
                    <div>
                      <p className="font-bold text-black">{parent.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider mt-0.5">UUID: {parent.id.slice(0, 12)}...</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAssignParent(parent.id)} 
                        className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-colors rounded-lg"
                        title="Assign to Family"
                      >
                        <UserCheck className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteParent(parent.id, parent.name, e)} 
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg"
                        title="Delete Parent Account"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => { setShowAssignParent(false); setSelectedFamilyId(""); }} className="w-full mt-6 py-3 text-gray-600 border border-gray-200 font-bold hover:bg-gray-50 rounded-xl transition-all">Close</button>
          </div>
        </div>
      )}

      {/* Create Family Modal */}
      {showCreateFamily && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-green-100">
            <h2 className="text-2xl font-bold text-black mb-6">Register New Family</h2>
            <div className="space-y-4">
              <input type="text" value={newFamily.name} onChange={(e) => setNewFamily({ name: e.target.value })} placeholder="Family Name (e.g. The Abraham's)" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none transition-all text-black font-medium" />
              <div className="flex gap-3">
                <button onClick={() => setShowCreateFamily(false)} className="flex-1 py-3 text-gray-600 border border-gray-200 font-bold hover:bg-gray-50 rounded-xl transition-all">Cancel</button>
                <button onClick={handleCreateFamily} disabled={isSubmitting} className="flex-1 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 shadow-md transition-all">
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