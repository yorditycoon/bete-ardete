import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { supabase } from "../lib/supabase";

interface Props {
  children: ReactNode;
  requiredRole?: "admin" | "parent" | "member";
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setAuthorized(false);
      } else {
        // Fetch the role from your profiles table to verify
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (requiredRole && profile?.role !== requiredRole) {
          setAuthorized(false);
        } else {
          setAuthorized(true);
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, [requiredRole]);

  if (loading) return <div>Loading...</div>;
  if (!authorized) return <Navigate replace to="/login" />;

  return <>{children}</>;
}