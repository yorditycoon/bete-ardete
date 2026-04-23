import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { 
  Users, Search, Phone, Mail, MapPin, 
  Droplet, AlertCircle, Calendar, Shield, 
  User, Loader2, ChevronRight, Filter, X
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

interface Profile {
  id: string;
  name?: string;
  full_name?: string;
  email?: string;
  role: string;
  family_id: string | null;
  phone_number?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  baptism_name?: string;
  emergency_contact_name?: string;
}

interface Family {
  id: string;
  name: string;
}

export function MemberDirectory() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "parent" | "member">("all");
  
  // Deep Dive Modal State
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchDirectoryData();

    // Keep directory synced in real-time
    const channel = supabase.channel('directory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchDirectoryData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchDirectoryData = async () => {
    try {
      setIsLoading(true);
      const [profilesRes, familiesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('name'),
        supabase.from('families').select('*')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (familiesRes.error) throw familiesRes.error;

      const formattedProfiles = (profilesRes.data || []).map(p => ({
        ...p,
        display_name: p.name || p.full_name || "Unknown Member"
      }));

      setProfiles(formattedProfiles);
      setFamilies(familiesRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load directory: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getFamilyName = (familyId: string | null) => {
    if (!familyId) return "Unassigned";
    const family = families.find(f => f.id === familyId);
    return family ? family.name : "Unknown Family";
  };

  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = 
      (profile.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (profile.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (profile.email?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (profile.phone_number || "").includes(searchQuery);
      
    const matchesRole = roleFilter === "all" || profile.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium text-sm sm:text-base">Loading church directory...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 w-full">
      
      {/* HEADER & SEARCH BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 shrink-0" />
              Member Directory
            </h1>
            <p className="text-gray-500 mt-1 text-xs sm:text-base">View and manage full congregational profiles.</p>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1 sm:px-4 sm:py-1.5 text-xs sm:text-sm self-start sm:self-auto shrink-0">
            {profiles.length} Total Members
          </Badge>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
            <Input 
              placeholder="Search by name, email, or phone..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 sm:pl-10 h-10 sm:h-12 bg-gray-50 border-gray-200 focus-visible:ring-green-600 focus-visible:bg-white text-sm sm:text-base rounded-xl w-full"
            />
          </div>
          {/* Filter buttons - horizontally scrollable on tiny mobile screens */}
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto no-scrollbar shrink-0 w-full lg:w-auto">
            <button 
              onClick={() => setRoleFilter("all")}
              className={`flex-1 lg:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap ${roleFilter === "all" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              All
            </button>
            <button 
              onClick={() => setRoleFilter("parent")}
              className={`flex-1 lg:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap ${roleFilter === "parent" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Parents
            </button>
            <button 
              onClick={() => setRoleFilter("member")}
              className={`flex-1 lg:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-lg transition-all whitespace-nowrap ${roleFilter === "member" ? "bg-white text-green-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Children
            </button>
          </div>
        </div>
      </div>

      {/* DIRECTORY LIST */}
      <div className="grid grid-cols-1 gap-3">
        {filteredProfiles.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-2xl border border-dashed border-gray-200 px-4">
            <Filter className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base sm:text-lg font-bold text-gray-900">No members found</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          filteredProfiles.map((profile) => (
            <div 
              key={profile.id}
              onClick={() => setSelectedProfile(profile)}
              className="group bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm hover:border-green-300 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
            >
              <div className="flex items-center gap-3 sm:gap-4 w-full min-w-0">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base sm:text-lg font-bold shrink-0 ${profile.role === 'parent' ? 'bg-green-600 text-white' : 'bg-blue-100 text-blue-700'}`}>
                  {(profile.name || profile.full_name || "U")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-sm sm:text-lg group-hover:text-green-700 transition-colors truncate max-w-full">
                      {profile.name || profile.full_name || "Unknown"}
                    </h3>
                    {profile.role === 'parent' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[9px] sm:text-[10px] uppercase tracking-wider h-4 sm:h-5 px-1 sm:px-1.5 shrink-0"><Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1"/> Parent</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] sm:text-[10px] uppercase tracking-wider h-4 sm:h-5 px-1 sm:px-1.5 shrink-0"><User className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1"/> Child</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] sm:text-sm text-gray-500">
                    <span className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-none"><Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0"/> <span className="truncate">{getFamilyName(profile.family_id)}</span></span>
                    {profile.phone_number && <span className="flex items-center gap-1"><span className="hidden sm:inline">•</span> <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0"/> {profile.phone_number}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 w-full sm:w-auto mt-1 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-50 shrink-0">
                <span className="text-[10px] sm:text-xs font-bold text-green-600 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">View Profile</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-green-50 group-hover:text-green-600 transition-colors shrink-0">
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DEEP DIVE MODAL */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6" onClick={() => setSelectedProfile(null)}>
          <div 
            className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-800 p-5 sm:p-8 text-white relative shrink-0">
              <button 
                onClick={() => setSelectedProfile(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="flex items-center gap-4 sm:gap-5 pr-8">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white text-green-700 flex items-center justify-center text-2xl sm:text-4xl font-black shadow-lg shrink-0">
                  {(selectedProfile.name || selectedProfile.full_name || "U")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-3xl font-bold truncate max-w-full">{selectedProfile.name || selectedProfile.full_name || "Unknown"}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1 sm:mt-2">
                    <Badge className="bg-white/20 hover:bg-white/20 text-white border-0 text-[10px] sm:text-xs">{selectedProfile.role.toUpperCase()}</Badge>
                    <span className="text-green-100 text-xs sm:text-sm flex items-center gap-1 truncate max-w-[150px] sm:max-w-none"><Users className="w-3 h-3 sm:w-4 sm:h-4 shrink-0"/> <span className="truncate">{getFamilyName(selectedProfile.family_id)}</span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              
              {/* Contact Info */}
              <div className="space-y-4 sm:space-y-5">
                <h3 className="text-xs sm:text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Contact Details</h3>
                
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600"/></div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-bold">Phone Number</p>
                    <p className="text-sm sm:text-base text-gray-900 font-medium truncate">{selectedProfile.phone_number || <span className="text-gray-300 italic">Not provided</span>}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600"/></div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-bold">Email (Login)</p>
                    <p className="text-sm sm:text-base text-gray-900 font-medium break-all">{selectedProfile.email || <span className="text-gray-300 italic">Hidden</span>}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600"/></div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 font-bold">Home Address</p>
                    <p className="text-sm sm:text-base text-gray-900 font-medium whitespace-normal">{selectedProfile.address || <span className="text-gray-300 italic">Not provided</span>}</p>
                  </div>
                </div>
              </div>

              {/* Personal & Church Info */}
              <div className="space-y-4 sm:space-y-5">
                <h3 className="text-xs sm:text-sm font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Personal & Church Data</h3>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600"/></div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-500 font-bold">Born</p>
                      <p className="text-xs sm:text-sm text-gray-900 font-medium truncate">{selectedProfile.date_of_birth ? new Date(selectedProfile.date_of_birth).toLocaleDateString() : "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600"/></div>
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-500 font-bold">Gender</p>
                      <p className="text-xs sm:text-sm text-gray-900 font-medium truncate">{selectedProfile.gender || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-indigo-50/50 p-2.5 sm:p-3 rounded-xl border border-indigo-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0"><Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600"/></div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-indigo-600 font-bold">Baptism Name</p>
                    <p className="text-indigo-900 font-bold text-sm sm:text-lg truncate">{selectedProfile.baptism_name || <span className="text-indigo-300 italic text-sm sm:text-base">Not provided</span>}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-red-50 p-2.5 sm:p-3 rounded-xl border border-red-100">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0"><AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600"/></div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-red-600 font-bold">Emergency Contact</p>
                    <p className="text-xs sm:text-sm text-red-900 font-bold whitespace-normal">{selectedProfile.emergency_contact_name || <span className="text-red-300 italic">None listed</span>}</p>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Modal Footer */}
            <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 rounded-b-2xl sm:rounded-b-3xl flex justify-end shrink-0">
              <Button variant="outline" onClick={() => setSelectedProfile(null)} className="font-bold border-gray-300 w-full sm:w-auto text-sm sm:text-base h-10 sm:h-11">
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}