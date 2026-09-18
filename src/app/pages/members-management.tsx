import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Users, Search, Loader2, ShieldAlert, Edit, UserCheck, Shield } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export function MembersManagement() {
  const [members, setMembers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit Modal State
  const [editingMember, setEditingMember] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedDeptRole, setSelectedDeptRole] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all departments
      const { data: depts, error: deptsError } = await supabase
        .from('departments')
        .select('*')
        .order('name_en', { ascending: true });
        
      if (deptsError) throw deptsError;
      setDepartments(depts || []);

      // 2. Fetch all members with their current department info
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*, departments(name_en, name_am)')
        .order('name', { ascending: true });

      if (profilesError) throw profilesError;
      setMembers(profiles || []);

    } catch (error: any) {
      toast.error("Failed to load directory: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenEdit = (member: any) => {
    setEditingMember(member);
    setSelectedRole(member.role || "member");
    setSelectedDepartment(member.department_id || "none");
    setSelectedDeptRole(member.department_role || "member");
  };

  const handleSavePermissions = async () => {
    if (!editingMember) return;
    setIsSaving(true);

    try {
      // If no department is selected, wipe the department role as well
      const isUnassigned = selectedDepartment === "none";
      
      const updates = {
        role: selectedRole,
        department_id: isUnassigned ? null : selectedDepartment,
        department_role: isUnassigned ? null : selectedDeptRole
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', editingMember.id);

      if (error) throw error;

      toast.success(`${editingMember.name}'s permissions updated!`);
      setEditingMember(null);
      fetchData(); // Refresh the list
    } catch (error: any) {
      toast.error("Failed to update: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'admin': return <Badge className="bg-purple-100 text-purple-800 border-purple-200"><ShieldAlert className="w-3 h-3 mr-1"/> IT Admin</Badge>;
      case 'parent': return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Shield className="w-3 h-3 mr-1"/> Group Leader</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700 border-gray-200"><UserCheck className="w-3 h-3 mr-1"/> Member</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-2" />
        <p className="text-sm text-gray-500">Loading church directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-6 sm:p-8 border border-green-200 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-green-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-green-700" />
            Church Directory & Staffing
          </h2>
          <p className="text-green-700 font-medium mt-1">Assign members to departments and manage leadership clearances.</p>
        </div>
      </div>

      <Card className="border-green-200 shadow-sm">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Member List</CardTitle>
            <CardDescription>Total Registered: {members.length}</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-gray-200"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500">
                <tr>
                  <th className="p-4 font-bold uppercase tracking-wider">Member Details</th>
                  <th className="p-4 font-bold uppercase tracking-wider">System Role</th>
                  <th className="p-4 font-bold uppercase tracking-wider">Assigned Department</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400 italic">No members match your search.</td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-green-50/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold border border-green-200 shrink-0">
                            {member.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {getRoleBadge(member.role)}
                      </td>
                      <td className="p-4 space-y-1">
                        {member.department_id ? (
                          <div>
                            <p className="font-bold text-gray-900">{member.departments?.name_en}</p>
                            <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 mt-1 capitalize">
                              {member.department_role || "Member"}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleOpenEdit(member)}
                          className="border-green-200 text-green-700 hover:bg-green-50"
                        >
                          <Edit className="w-4 h-4 mr-2" /> Assign
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <h2 className="text-2xl font-black text-gray-900 mb-1">Edit Assignments</h2>
            <p className="text-sm text-gray-500 mb-6">Modify roles and departments for <strong className="text-green-700">{editingMember.name}</strong>.</p>
            
            <div className="space-y-5">
              
              <div className="space-y-2">
                <Label className="font-bold text-gray-700 uppercase tracking-wider text-xs">System Level Access</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="border-gray-200 h-12">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  {/* ADDED: max-h-[200px] and overflow-y-auto */}
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    <SelectItem value="member">Standard Member</SelectItem>
                    <SelectItem value="parent">Group Leader (Parent)</SelectItem>
                    <SelectItem value="admin">IT Admin (Full Access)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-400 leading-tight mt-1">
                  * Admins manage system settings. Group Leaders manage families. Members consume content.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <Label className="font-bold text-gray-700 uppercase tracking-wider text-xs">Department Assignment</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="border-gray-200 h-12">
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  {/* ADDED: max-h-[200px] and overflow-y-auto */}
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                    <SelectItem value="none">-- Unassigned --</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name_en} ({dept.name_am})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDepartment !== "none" && (
                <div className="space-y-2">
                  <Label className="font-bold text-gray-700 uppercase tracking-wider text-xs text-green-700">Role Within Department</Label>
                  <Select value={selectedDeptRole} onValueChange={setSelectedDeptRole}>
                    <SelectTrigger className="border-green-200 bg-green-50/50 h-12">
                      <SelectValue placeholder="Select clearance level" />
                    </SelectTrigger>
                    {/* ADDED: max-h-[200px] and overflow-y-auto */}
                    <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="member">Standard Member</SelectItem>
                      <SelectItem value="secretary">Secretarial</SelectItem>
                      <SelectItem value="deputy">Deputy Head</SelectItem>
                      <SelectItem value="head">Department Head</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

            </div>

            <div className="flex gap-3 justify-end mt-8 border-t border-gray-100 pt-5">
              <Button 
                variant="ghost" 
                onClick={() => setEditingMember(null)}
                className="text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 font-bold px-6 shadow-md"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}