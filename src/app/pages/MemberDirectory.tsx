import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue  } from "../components/ui/select";

import { Users, Search, Loader2, Edit } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export function MemberDirectory() {
  const [members, setMembers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit Modal State
  const [editingMember, setEditingMember] = useState<any>(null);
  const [familyRole, setFamilyRole] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [deptRole, setDeptRole] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: depts } = await supabase.from('departments').select('*').order('name_en', { ascending: true });
      setDepartments(depts || []);

      const { data: profiles } = await supabase.from('profiles').select('*, departments(name_en, name_am)').order('name', { ascending: true });
      setMembers(profiles || []);
    } catch (error: any) {
      toast.error("Failed to load directory");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenEdit = (member: any) => {
    setEditingMember(member);
    setFamilyRole(member.role === 'admin' ? 'member' : (member.role || "member")); 
    setSelectedDepartment(member.department_id || "none");
    setDeptRole(member.department_role || "member");
  };

  const handleSavePermissions = async () => {
    if (!editingMember) return;
    setIsSaving(true);

    try {
      const updates = {
        role: familyRole, 
        department_id: selectedDepartment === "none" ? null : selectedDepartment,
        department_role: selectedDepartment === "none" ? null : deptRole 
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', editingMember.id);
      if (error) throw error;

      toast.success(`${editingMember.name}'s roles updated!`);
      setEditingMember(null);
      fetchData(); 
    } catch (error: any) {
      toast.error("Failed to update: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = members.filter(m => m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || m.email?.toLowerCase().includes(searchQuery.toLowerCase()));

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-2">
            <Users className="w-8 h-8 text-green-600" /> System Directory
          </h2>
          <p className="text-gray-600 font-medium mt-1">Assign family roles and department leadership positions independently.</p>
        </div>
      </div>

      <Card className="border-green-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-xl text-black">Member List</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search members..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-white border-green-200 text-black"/>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4 font-bold">Member</th>
                  <th className="p-4 font-bold">Family Role</th>
                  <th className="p-4 font-bold">Department</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-green-50/50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-black">{member.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{member.email}</p>
                    </td>
                    <td className="p-4">
                      {member.role === 'parent' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 font-bold">Parent</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-white text-gray-600 border-gray-200">Child</Badge>
                      )}
                    </td>
                    <td className="p-4">
                      {member.department_id ? (
                        <div>
                          <p className="font-bold text-black">{member.departments?.name_en}</p>
                          {member.department_role === 'head' && (
                            <Badge className="bg-black text-white text-[10px] mt-1 border-none font-bold">Dept Head</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">None</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(member)} className="border-green-200 text-green-700 hover:bg-green-50 font-bold">
                        <Edit className="w-4 h-4 mr-2" /> Assign
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* EDIT MODAL */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-green-100 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-black mb-1">Edit {editingMember.name}</h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">Update community permissions and department assignment.</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-black uppercase text-xs">Family Role</Label>
                <Select value={familyRole} onValueChange={setFamilyRole}>
                  <SelectTrigger className="border-green-200"><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    <SelectItem value="member">Child / Standard Member</SelectItem>
                    <SelectItem value="parent">Parent / Head of Household</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-4">
                <Label className="font-bold text-black uppercase text-xs">Department Assignment</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="border-green-200"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    <SelectItem value="none">-- Unassigned --</SelectItem>
                    {departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name_en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {selectedDepartment !== "none" && (
                <div className="space-y-2">
                  <Label className="font-bold text-black uppercase text-xs">Role within Department</Label>
                  <Select value={deptRole} onValueChange={setDeptRole}>
                    <SelectTrigger className="border-green-200"><SelectValue placeholder="Dept Role" /></SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="member">Department Member</SelectItem>
                      <SelectItem value="head">Department Head (Admin Access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-8 pt-4 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setEditingMember(null)} className="font-bold text-gray-600">Cancel</Button>
              <Button onClick={handleSavePermissions} disabled={isSaving} className="bg-black hover:bg-gray-800 text-white font-bold">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}