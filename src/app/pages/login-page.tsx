import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { supabase } from "../lib/supabase"; 

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-white p-4">
      
      <div className="w-full max-w-md">
        <Card className="border-green-200 shadow-lg">
          <CardHeader className="text-center space-y-4">
            
            <div className="mx-auto w-32 h-32 bg-green-50 rounded-full flex items-center justify-center p-3 overflow-hidden border border-green-100 shadow-sm">
              <img 
                src="/church-logo.png" 
                alt="Bete Ardete Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }} 
              />
            </div>

            <div>
              <CardTitle className="text-3xl font-bold text-gray-900">Bete Ardete</CardTitle>
              <CardDescription className="text-base mt-2 font-medium text-gray-500">
                Family Management System
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="email" className="font-bold text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-green-200 focus-visible:ring-green-600 focus-visible:border-green-600"
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="password" className="font-bold text-gray-700">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-green-200 focus-visible:ring-green-600 focus-visible:border-green-600"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 font-bold text-white shadow-md transition-all py-6 text-lg mt-2" 
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            {/* Agency Branding Footer - Now inside the box */}
            <div className="mt-8 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs sm:text-sm text-gray-400 font-medium">
                Powered by{" "}
                <a 
                  href="https://www.novacreativesolutions.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-green-600 hover:text-green-700 font-bold hover:underline transition-colors"
                >
                  Nova Creatives
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}