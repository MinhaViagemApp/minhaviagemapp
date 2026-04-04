import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  companyId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  companyId: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.role || null;
  };

  const fetchCompanyId = async (userId: string) => {
    const { data } = await supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.company_id || null;
  };

  const ensureProfileAndRole = async (currentUser: User) => {
    const fallbackRole = currentUser.user_metadata?.role === "admin" ? "admin" : "cliente";

    // Ensure profile exists
    await supabase.from("profiles").upsert({
      id: currentUser.id,
      email: currentUser.email ?? null,
      name: currentUser.user_metadata?.name ?? null,
    });

    // Fetch role
    let role = await fetchUserRole(currentUser.id);
    if (!role) {
      const { error } = await supabase.from("user_roles").upsert(
        { user_id: currentUser.id, role: fallbackRole },
        { onConflict: "user_id,role" }
      );
      role = error ? null : fallbackRole;
    }
    setUserRole(role);

    // Fetch company_id
    const cid = await fetchCompanyId(currentUser.id);
    setCompanyId(cid);

    // If admin and no company, auto-create one
    if (role === "admin" && !cid) {
      const slug = (currentUser.email?.split("@")[0] || "empresa") + "-" + Date.now();
      const { data: newCompany } = await supabase
        .from("companies")
        .insert({ name: "Minha Empresa", slug })
        .select("id")
        .single();
      if (newCompany) {
        await supabase.from("user_companies").insert({
          user_id: currentUser.id,
          company_id: newCompany.id,
        });
        setCompanyId(newCompany.id);
      }
    }
  };

  useEffect(() => {
    const syncAuthState = async (nextSession: Session | null) => {
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await ensureProfileAndRole(nextSession.user);
      } else {
        setUserRole(null);
        setCompanyId(null);
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncAuthState(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, userRole, companyId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
