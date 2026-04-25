import {
  LayoutDashboard,
  Users,
  Plane,
  CreditCard,
  Tag,
  Bell,
  LogOut,
  Building2,
  MapPinned,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Clientes", url: "/admin/clients", icon: Users },
  { title: "Viagens", url: "/admin/trips", icon: Plane },
  { title: "Pagamentos", url: "/admin/payments", icon: CreditCard },
  { title: "Promoções", url: "/admin/promotions", icon: Tag },
  { title: "Perfil Empresa", url: "/admin/profile", icon: Building2 },
];

const clientItems = [
  { title: "Minha Viagem", url: "/client", icon: Plane },
  { title: "Pagamentos", url: "/client/payments", icon: CreditCard },
  { title: "Promoções", url: "/client/promotions", icon: Tag },
  { title: "Notificações", url: "/client/notifications", icon: Bell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { userRole, signOut } = useAuth();

  const items = userRole === "admin" ? adminItems : clientItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-3">
            {!collapsed ? (
              <img src={logo} alt="Minha Viagem" className="h-10 w-auto" />
            ) : (
              <img src={logo} alt="MV" className="h-8 w-auto" />
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin" || item.url === "/client"}
                      className="hover:bg-primary/10 transition-colors rounded-lg"
                      activeClassName="bg-primary/20 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
