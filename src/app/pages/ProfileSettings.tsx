import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  User, Users, Phone, Calendar, MapPin, 
  Droplet, AlertCircle, Save, Loader2, GraduationCap 
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    date_of_birth: "",
    gender: "",
    address: "",
    baptism_name: "", 
    emergency_contact_name: "",
    university: "" // <-- ADDED UNIVERSITY STATE
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("No user found");
      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name || data.full_name || "",
          phone_number: data.phone_number || "",
          date_of_birth: data.date_of_birth || "",
          gender: data.gender || "",
          address: data.address || "",
          baptism_name: data.baptism_name || "", 
          emergency_contact_name: data.emergency_contact_name || "",
          university: data.university || "" // <-- LOAD UNIVERSITY
        });
      }
    } catch (error: any) {
      toast.error("Error loading profile: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          phone_number: formData.phone_number,
          date_of_birth: formData.date_of_birth || null, 
          gender: formData.gender,
          address: formData.address,
          baptism_name: formData.baptism_name, 
          emergency_contact_name: formData.emergency_contact_name,
          university: formData.university // <-- SAVE UNIVERSITY
        })
        .eq("id", userId);

      if (error) throw error;
      
      const currentUserData = JSON.parse(localStorage.getItem("currentUser") || "{}");
      localStorage.setItem("currentUser", JSON.stringify({ ...currentUserData, name: formData.name }));

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error("Failed to update profile: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium text-sm sm:text-base">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 w-full">
      {/* RESPONSIVE BANNER */}
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-4 sm:p-6 border border-green-200 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-green-900 flex items-center gap-2">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 shrink-0" /> My Profile
          </h2>
          <p className="text-xs sm:text-sm text-green-700 font-medium mt-1">Keep your church records up to date.</p>
        </div>
      </div>

      <Card className="border-green-100 shadow-sm">
        {/* RESPONSIVE HEADER */}
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Personal Information</CardTitle>
          <CardDescription className="text-xs sm:text-sm">This information is kept private and only visible to church administration.</CardDescription>
        </CardHeader>
        
        {/* RESPONSIVE CONTENT & GRIDS */}
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" /> Full Name
              </Label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                className="focus-visible:ring-green-600 h-10 sm:h-11 text-sm sm:text-base"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" /> Phone Number
              </Label>
              <Input 
                type="tel"
                placeholder="+971 50 123 4567"
                value={formData.phone_number} 
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} 
                className="focus-visible:ring-green-600 h-10 sm:h-11 text-sm sm:text-base"
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" /> Date of Birth
              </Label>
              <Input 
                type="date"
                value={formData.date_of_birth} 
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} 
                className="focus-visible:ring-green-600 h-10 sm:h-11 text-sm sm:text-base"
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" /> Gender
              </Label>
              <Select value={formData.gender} onValueChange={(val) => setFormData({ ...formData, gender: val })}>
                <SelectTrigger className="focus-visible:ring-green-600 h-10 sm:h-11 text-sm sm:text-base">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* University / Institution */}
          <div className="space-y-2 border-t border-gray-100 pt-4 sm:pt-6">
            <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
              <GraduationCap className="w-4 h-4 text-green-600 shrink-0" /> University / Institution
            </Label>
            <Input 
              placeholder="e.g. American University in Dubai"
              value={formData.university} 
              onChange={(e) => setFormData({ ...formData, university: e.target.value })} 
              className="focus-visible:ring-green-600 h-10 sm:h-11 text-sm sm:text-base"
            />
          </div>

          {/* Address (Full Width) */}
          <div className="space-y-2 border-t border-gray-100 pt-4 sm:pt-6">
            <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" /> Home Address
            </Label>
            <Textarea 
              placeholder="Villa/Apartment No, Building Name, Street, City..."
              value={formData.address} 
              onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
              className="resize-none h-20 sm:h-24 focus-visible:ring-green-600 text-sm sm:text-base"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 border-t border-gray-100 pt-4 sm:pt-6">
            {/* Baptism Name */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
                <Droplet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" /> Baptism Name
              </Label>
              <Input 
                type="text"
                placeholder="Enter baptism name..."
                value={formData.baptism_name} 
                onChange={(e) => setFormData({ ...formData, baptism_name: e.target.value })} 
                className="focus-visible:ring-green-600 h-10 sm:h-11 text-sm sm:text-base"
              />
            </div>

            {/* Emergency Contact */}
            <div className="space-y-2">
              <Label className="text-gray-700 font-bold flex items-center gap-2 text-xs sm:text-sm">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 shrink-0" /> Emergency Contact
              </Label>
              <Input 
                placeholder="Name & Phone Number"
                value={formData.emergency_contact_name} 
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} 
                className="focus-visible:ring-green-600 h-10 sm:h-11 text-sm sm:text-base"
              />
            </div>
          </div>

          {/* RESPONSIVE BUTTON */}
          <div className="pt-4 sm:pt-6 flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 font-bold text-white px-6 py-5 sm:px-8 sm:py-6 shadow-md transition-all text-sm sm:text-base"
            >
              {isSaving ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mr-2 shrink-0" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />}
              {isSaving ? "Saving..." : "Save Profile Details"}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}