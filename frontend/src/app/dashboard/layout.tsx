"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { LayoutDashboardIcon, UsersIcon, LogOutIcon, UserCircle, Loader2, SettingsIcon, MenuIcon, XIcon, InfoIcon } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("No token");
        
        const userData = await fetchApi<any>("/auth/me");
        setUser(userData);
      } catch (error) {
        localStorage.removeItem("token");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.clear();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboardIcon },
    { name: "Students", href: "/dashboard/students", icon: UsersIcon },
    { name: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
    { name: "About", href: "/dashboard/about", icon: InfoIcon },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Sidebar — Desktop only */}
      <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-xl font-bold tracking-tight text-primary">FaceLate AI</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.name} href={item.href}>
                <span className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}>
                  <item.icon className={`h-5 w-5 mr-3 ${isActive ? "text-primary" : "text-slate-400"}`} />
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center px-3 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 mb-4">
            <UserCircle className="h-8 w-8 text-slate-500 mr-3" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOutIcon className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header with Burger */}
        <header className="h-16 shrink-0 md:hidden flex items-center justify-between px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
          <h1 className="text-xl font-bold tracking-tight text-primary">FaceLate AI</h1>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </header>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop overlay */}
            <div 
              className="md:hidden fixed inset-0 top-16 bg-black/30 z-40 animate-in fade-in duration-200"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Menu panel */}
            <div className="md:hidden fixed left-0 right-0 top-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in slide-in-from-top-2 duration-200">
              <div className="p-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link key={item.name} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                      <span className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                      }`}>
                        <item.icon className={`h-5 w-5 mr-3 ${isActive ? "text-primary" : "text-slate-400"}`} />
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 p-3">
                <div className="flex items-center px-4 py-2 mb-2">
                  <UserCircle className="h-7 w-7 text-slate-400 mr-3 shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                >
                  <LogOutIcon className="h-5 w-5 mr-3" />
                  Logout
                </button>
              </div>
            </div>
          </>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}

          {/* Footer */}
          <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-8 pb-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                {/* Left: Branding */}
                <div className="text-center md:text-left space-y-2">
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">FaceLate AI</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                    Sistem Absensi Keterlambatan Siswa Berbasis Face Recognition &mdash; Karya Mahasiswa KKN STKIP YAPIS Dompu.
                  </p>
                </div>

                {/* Center: Logos */}
                <div className="flex items-center gap-4">
                  <img src="/LOGO/LOGOSTKIP.png" alt="STKIP YAPIS" className="h-10 w-10 object-contain rounded-lg bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" />
                  <img src="/LOGO/LOGOKKN.png" alt="KKN" className="h-10 w-10 object-contain rounded-lg bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" />
                  <img src="/LOGO/LOGOSMP1DOMPU.png" alt="SMP 1 Dompu" className="h-10 w-10 object-contain rounded-lg bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" />
                </div>

                {/* Right: Links */}
                <div className="flex flex-col items-center md:items-end gap-1 text-xs">
                  <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-primary transition-colors">Overview</Link>
                  <Link href="/dashboard/students" className="text-slate-500 dark:text-slate-400 hover:text-primary transition-colors">Students</Link>
                  <Link href="/dashboard/about" className="text-slate-500 dark:text-slate-400 hover:text-primary transition-colors">About</Link>
                </div>
              </div>

              {/* Bottom line */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  &copy; {new Date().getFullYear()} KKN STKIP YAPIS Dompu &mdash; SMP Negeri 1 Dompu. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
