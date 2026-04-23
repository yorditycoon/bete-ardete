import { useState } from "react";
import { Plus, Users, Mail, Eye, EyeOff, Key, Trash2, UserCheck } from "lucide-react";
import { mockUsers, User } from "../lib/mock-data";
import { useAuth } from "../lib/auth-context";

export function MembersManagement() {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<User[]>(
    mockUsers.filter(u => u.familyId === currentUser?.familyId && u.role === "member")
  );
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    password: "123456",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleAddMember = () => {
    if (!newMember.name.trim() || !newMember.email.trim() || !newMember.password.trim()) {
      alert("Please fill in all fields");
      return;
    }

    const member: User = {
      id: `m${Date.now()}`,
      email: newMember.email,
      password: newMember.password,
      name: newMember.name,
      role: "member",
      familyId: currentUser?.familyId,
      familyName: currentUser?.familyName,
      hasAccess: false, // Default to no access
      createdBy: currentUser?.id,
    };

    setMembers([...members, member]);
    setNewMember({ name: "", email: "", password: "123456" });
    setShowAddMember(false);
  };

  const handleToggleAccess = (memberId: string) => {
    setMembers(members.map(m => {
      if (m.id === memberId) {
        return { ...m, hasAccess: !m.hasAccess };
      }
      return m;
    }));
  };

  const handleDeleteMember = (memberId: string) => {
    if (!confirm("Are you sure you want to delete this member?")) return;
    setMembers(members.filter(m => m.id !== memberId));
  };

  const generatePassword = () => {
    const password = Math.random().toString(36).slice(-8);
    setNewMember({ ...newMember, password });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Family Members</h1>
          <p className="text-gray-600 mt-1">
            Manage members of {currentUser?.familyName}
          </p>
        </div>
        <button
          onClick={() => setShowAddMember(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#90EE90] text-gray-900 rounded-lg hover:bg-green-400"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-medium mb-2 text-gray-900">No Members Yet</h3>
          <p className="text-gray-600 mb-6">
            Add your first family member to get started
          </p>
          <button
            onClick={() => setShowAddMember(true)}
            className="px-4 py-2 bg-[#90EE90] text-gray-900 rounded-lg hover:bg-green-400"
          >
            Add First Member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member) => (
            <div
              key={member.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#90EE90] flex items-center justify-center">
                    <Users className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteMember(member.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Access Status */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Login Access</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      member.hasAccess
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {member.hasAccess ? "Granted" : "Not Granted"}
                  </span>
                </div>

                <button
                  onClick={() => handleToggleAccess(member.id)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    member.hasAccess
                      ? "bg-red-50 text-red-700 hover:bg-red-100"
                      : "bg-green-50 text-green-700 hover:bg-green-100"
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  {member.hasAccess ? "Revoke Access" : "Grant Access"}
                </button>
              </div>

              {/* Credentials Info */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Password:</strong> {member.password}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Share credentials securely with the member
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Family Member</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="member@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newMember.password}
                      onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#90EE90]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Member won't be able to login until you grant access.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMember({ name: "", email: "", password: "123456" });
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMember}
                  className="px-4 py-2 bg-[#90EE90] text-gray-900 rounded-lg hover:bg-green-400"
                >
                  Add Member
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Member Management Guide</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Add family members and create their login credentials</li>
          <li>• Grant or revoke login access as needed</li>
          <li>• Share credentials securely with each member</li>
          <li>• Members can participate in Bible readings, quizzes, and events</li>
        </ul>
      </div>
    </div>
  );
}