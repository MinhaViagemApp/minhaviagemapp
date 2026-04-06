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

  const buildCompanySlug = (currentUser: User) => {
    const base = currentUser.user_metadata?.name || currentUser.email?.split("@")[0] || "empresa";

    return `${base
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "empresa"}-${Date.now()}`;
  };

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar role do usuário:", error);
    }

    return data?.role || null;
  };

  const fetchCompanyId = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_companies")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar company_id do usuário:", error);
    }

    return data?.company_id || null;
  };

  const createCompanyForAdmin = async (currentUser: User) => {
    const companyPayload = {
      name: currentUser.user_metadata?.name || "Minha Empresa",
      slug: buildCompanySlug(currentUser),
    };

    console.log("Payload enviado (empresa automática):", companyPayload);

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert(companyPayload)
      .select("id")
      .single();

    if (companyError) {
      console.error("Erro Supabase (empresa automática):", companyError);
      return null;
    }

    console.log("Sucesso (empresa automática):", company);

    const membershipPayload = {
      user_id: currentUser.id,
      company_id: company.id,
    };

    console.log("Payload enviado (vínculo user_companies):", membershipPayload);

    const { error: membershipError } = await supabase.from("user_companies").insert(membershipPayload);

    if (membershipError) {
      console.error("Erro Supabase (vínculo user_companies):", membershipError);
      return null;
    }

    console.log("Sucesso (vínculo user_companies):", membershipPayload);

    return company.id;
  };

  const ensureProfileAndRole = async (currentUser: User) => {
    const fallbackRole = currentUser.user_metadata?.role === "admin" ? "admin" : "cliente";

    console.log("Sincronizando autenticação:", {
      email: currentUser.email,
      fallbackRole,
      userId: currentUser.id,
    });

    // Ensure profile exists
    const profilePayload = {
      id: currentUser.id,
      email: currentUser.email ?? null,
      name: currentUser.user_metadata?.name ?? null,
    };

    console.log("Payload enviado (profile sync):", profilePayload);

    const { error: profileError } = await supabase.from("profiles").upsert(profilePayload);

    if (profileError) {
      console.error("Erro Supabase (profile sync):", profileError);
    }

    // Fetch role
    let role = await fetchUserRole(currentUser.id);
    if (!role) {
      const rolePayload = { user_id: currentUser.id, role: fallbackRole };

      console.log("Payload enviado (user_roles):", rolePayload);

      const { error } = await supabase.from("user_roles").insert(rolePayload);

      if (error) {
        console.error("Erro Supabase (user_roles):", error);
        role = await fetchUserRole(currentUser.id);
      } else {
        role = fallbackRole;
        console.log("Sucesso (user_roles):", rolePayload);
      }
    }

    setUserRole(role);

    // Fetch company_id
    let cid = await fetchCompanyId(currentUser.id);

    // If admin and no company, auto-create one
    if (role === "admin" && !cid) {
      cid = await createCompanyForAdmin(currentUser);
    }

    setCompanyId(cid);

    console.log("Auth sincronizada:", {
      companyId: cid,
      role,
      userId: currentUser.id,
    });
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
