import {
  LayoutDashboard,
  Building2,
  CreditCard,
  MousePointerClick,
  LogOut,
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

const items = [
  { title: "Visão Geral", url: "/superadmin", icon: LayoutDashboard },
  { title: "Agências", url: "/superadmin/agencies", icon: Building2 },
  { title: "Assinaturas", url: "/superadmin/subscriptions", icon: CreditCard },
  { title: "Cliques & Campanhas", url: "/superadmin/clicks", icon: MousePointerClick },
];

export function SuperAdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();

  const onClick = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-3">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <img src={logo} alt="Logo" className="h-9 w-auto" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
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
                      end={item.url === "/superadmin"}
                      onClick={onClick}
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
          onClick={() => { onClick(); signOut(); }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
