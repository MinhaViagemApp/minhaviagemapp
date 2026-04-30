import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    return data?.role || null;
  };

  const ensureProfileAndRole = async (currentUser: User) => {
    try {
      const fallbackRole = currentUser.user_metadata?.role === "admin" ? "admin" : "cliente";

      await supabase.from("profiles").upsert({
        id: currentUser.id,
        email: currentUser.email ?? null,
        name: currentUser.user_metadata?.name ?? null,
        phone: currentUser.user_metadata?.phone ?? null,
      });

      let role = await fetchUserRole(currentUser.id);

      if (!role) {
        const { error } = await supabase.from("user_roles").upsert(
          { user_id: currentUser.id, role: fallbackRole },
          { onConflict: "user_id,role" }
        );

        role = error ? null : fallbackRole;
      }

      setUserRole(role);

      // Vincula parcelas órfãs (criadas pelo admin antes do cadastro do cliente)
      // ao auth.uid() — usa client_id como chave segura (uma parcela = um cliente)
      if (currentUser.email) {
        try {
          const { data: client } = await supabase
            .from("clients")
            .select("id")
            .eq("email", currentUser.email)
            .maybeSingle();
          if (client?.id) {
            await supabase
              .from("installments")
              .update({ user_id: currentUser.id })
              .eq("client_id", client.id)
              .is("user_id", null);
          }
        } catch (e) {
          console.warn("Falha ao vincular parcelas órfãs:", e);
        }
      }
    } catch (error) {
      console.error("Erro ao sincronizar perfil/role:", error);
      // Mantém o usuário logado com papel padrão se falhar
      setUserRole(currentUser.user_metadata?.role || "cliente");
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
    <AuthContext.Provider value={{ session, user, userRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
