"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Lightbulb, 
  CheckSquare, 
  LogOut,
  Menu,
  X,
  Settings,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/components/button";

import { CommandMenu } from "@/ui/components/CommandMenu";
import { Search } from "lucide-react";
import { logoutAction } from "@/modules/shared/infrastructure/actions/authActions";
import { createClient } from "@/infrastructure/database/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/components/avatar";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: LayoutDashboard }, // Kanban
  { name: "Ideas", href: "/ideas", icon: Lightbulb },
  { name: "Actividades", href: "/activities", icon: CheckSquare },
  { name: "Ajustes", href: "/settings/profile", icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [userData, setUserData] = React.useState<{ email?: string; name?: string; avatar_url?: string } | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function fetchUser() {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        
        if (!user || !isMounted) return;

        // Set initial user info from Auth
        setUserData({
          email: user.email,
          name: user.email?.split('@')[0],
        });

        // Try to get profile info - TEMPORARILY DISABLED FOR DEBUGGING
        /*
        const { data: profiles } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id);
        
        if (isMounted && profiles && profiles.length > 0) {
          const profile = profiles[0];
          setUserData({
            email: user.email,
            name: profile.full_name || user.email?.split('@')[0],
            avatar_url: profile.avatar_url
          });
        }
        */
      } catch (error) {
        // Silent catch to avoid crashing the overlay
        console.debug("Layout fetchUser error (handled):", error);
      }
    }
    fetchUser();
    return () => { isMounted = false; };
  }, []);

  const handleLogout = async () => {
    await logoutAction();
  };

  return (
    <div className="min-h-screen bg-background">
      <CommandMenu />
      {/* Mobile sidebar overlay */}
      <div 
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden",
          isSidebarOpen ? "block" : "hidden"
        )} 
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-6 border-b">
            <span className="text-lg font-bold">IdeaLeadsHub</span>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t space-y-4">
            {userData && (
              <div className="flex items-center px-2 py-2 mb-2">
                <Avatar className="h-9 w-9 mr-3">
                  <AvatarImage src={userData.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate">{userData.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{userData.email}</span>
                </div>
              </div>
            )}
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-background/80 backdrop-blur border-b lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <Button 
              variant="outline" 
              className="hidden md:flex relative h-9 w-64 justify-start text-sm text-muted-foreground"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            >
              <Search className="mr-2 h-4 w-4" />
              Buscar...
              <kbd className="pointer-events-none absolute right-2 top-2 h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>
          {/* Profile/User Menu could go here */}
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
