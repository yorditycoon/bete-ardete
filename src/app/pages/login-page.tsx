import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { supabase } from "../lib/supabase"; 
import { ShieldCheck } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      localStorage.setItem("currentUser", JSON.stringify(profileData));
      toast.success(`Welcome back, ${profileData.name}!`);
      
      if (profileData.role === "admin") {
        navigate("/app/admin-dashboard"); 
      } else if (profileData.role === "parent") {
        navigate("/app/parent-dashboard"); 
      } else {
        navigate("/app/member-dashboard");
      }
      
    } catch (error: any) {
      console.error("LOGIN ERROR:", error); 
      toast.error(error.message); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 animate-in fade-in duration-500">
      
      <div className="w-full max-w-md">
        <Card className="border-green-200 shadow-xl bg-white rounded-2xl overflow-hidden">
          <CardHeader className="text-center space-y-4 pt-8">
            
            <div className="mx-auto w-28 h-28 bg-green-50 rounded-full flex items-center justify-center p-3 overflow-hidden border border-green-200 shadow-sm relative">
              {!logoFailed ? (
                <img 
                  src="/church-logo.png" 
                  alt="Bete Ardete Logo" 
                  className="w-full h-full object-contain"
                  onError={() => setLogoFailed(true)} 
                />
              ) : (
                <ShieldCheck className="w-12 h-12 text-green-600" />
              )}
            </div>

            <div>
              <CardTitle className="text-3xl font-black text-black">Bete Ardete</CardTitle>
              <CardDescription className="text-sm mt-1 font-semibold text-gray-500 uppercase tracking-widest">
                Family Management System
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="pb-8 px-6 sm:px-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <Label htmlFor="email" className="font-bold text-black text-xs uppercase tracking-wider">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-green-200 focus-visible:ring-green-600 focus-visible:border-green-600 h-12 text-black font-medium"
                />
              </div>
              <div className="space-y-1.5 text-left">
                <Label htmlFor="password" className="font-bold text-black text-xs uppercase tracking-wider">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-green-200 focus-visible:ring-green-600 focus-visible:border-green-600 h-12 text-black font-medium"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 font-bold text-white shadow-md transition-all py-6 text-lg mt-4 rounded-xl" 
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {/* Custom Footer Message */}
            <div className="mt-8 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500 font-bold tracking-wide">
                በፀሎታችሁ አስቡኝ 🙏
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}