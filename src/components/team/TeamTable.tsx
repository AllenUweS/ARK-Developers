import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeFormDialog } from "./EmployeeFormDialog";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { AddEditBdoDialog } from "@/components/bdo/AddEditBdoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Loader2, Search, Mail, Briefcase, Building, Phone, Pencil, Users, KeyRound } from "lucide-react";
import { toast } from "sonner";

const HIERARCHY: Record<string, number> = {
  "SUPER_ADMIN": 1,
  "SUPER ADMIN": 1,
  "ADMIN": 2,
  "ADMINS": 2,
  "MANAGEMENT": 3,
  "ACCOUNTS": 4,
  "ACCOUNTANT": 4,
  "SALES HEAD": 5,
  "SALES HEADS": 5,
  "MANAGER": 5,
  "MANAGERS": 5,
  "CRM": 6,
  "CRM TEAM": 6,
  "HR": 7,
  "EXECUTIVE": 8,
  "EXECUTIVES": 8,
  "EMPLOYEE": 8,
  "EMPLOYEES": 8,
};

const getPriority = (name: string) => HIERARCHY[name] || 99;

const getRoleGradient = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('super')) return 'bg-gradient-to-r from-stone-800 to-stone-600 text-white border-transparent shadow-sm';
  if (r.includes('management')) return 'bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600 text-white border-transparent shadow-sm';
  if (r.includes('accounts') || r.includes('accountant')) return 'bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 text-white border-transparent shadow-sm';
  if (r.includes('crm')) return 'bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 text-white border-transparent shadow-sm';
  if (r.includes('admin')) return 'bg-gradient-to-r from-orange-700 to-orange-500 text-white border-transparent shadow-sm';
  if (r.includes('manager')) return 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white border-transparent shadow-sm';
  if (r.includes('hr')) return 'bg-gradient-to-r from-rose-700 to-rose-500 text-white border-transparent shadow-sm';
  return 'bg-gradient-to-r from-stone-500 to-stone-400 text-white border-transparent shadow-sm';
};

export function TeamTable() {
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passwordTargetEmployee, setPasswordTargetEmployee] = useState<any | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const qc = useQueryClient();

  // BDO Partner State
  const [editingBdo, setEditingBdo] = useState<any | null>(null);
  const [isBdoDialogOpen, setIsBdoDialogOpen] = useState(false);

  const { data: bdoPartners = [] } = useQuery({
    queryKey: ["all-bdo-partners"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bdo_partners")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const toggleBdoStatus = async (bdo: any, checked: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("bdo_partners")
        .update({ is_active: checked })
        .eq("id", bdo.id);

      if (error) throw error;
      toast.success(`${bdo.name} status updated to ${checked ? "Active" : "Inactive"}`);
      qc.invalidateQueries({ queryKey: ["all-bdo-partners"] });
      qc.invalidateQueries({ queryKey: ["active-bdo-partners"] });
    } catch (err: any) {
      toast.error("Failed to update BDO status");
    }
  };

  const { data: currentUser } = useQuery({
    queryKey: ["current_user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ["role", currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_primary_role", { _user_id: currentUser!.id });
      return (data as string) ?? "employee";
    },
  });

  const isAdmin = userRole === "admin" || userRole === "super_admin" || userRole === "management";

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["team_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["team_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingProfiles || isLoadingRoles;

  const teamMembers = useMemo(() => {
    const basicProfiles = profiles?.map((profile) => {
      const userRoles = roles?.filter((r) => r.user_id === profile.id) || [];
      const roleMap = userRoles.map(r => r.role);
      let primaryRole = "employee";
      if (roleMap.includes("super_admin")) primaryRole = "super_admin";
      else if (roleMap.includes("admin")) primaryRole = "admin";
      else if (roleMap.includes("management")) primaryRole = "management";
      else if (roleMap.includes("accounts")) primaryRole = "accounts";
      else if (roleMap.includes("manager")) primaryRole = "manager";
      else if (roleMap.includes("crm")) primaryRole = "crm";

      return {
        ...profile,
        role: primaryRole,
      };
    }) || [];

    return basicProfiles.map((profile) => {
      let groupName = profile.role === "crm" ? "CRM TEAM" : profile.role === "manager" ? "SALES HEADS" : profile.role === "employee" ? "EXECUTIVES" : profile.role.toUpperCase();

      return {
        ...profile,
        groupName,
      };
    });
  }, [profiles, roles]);

  const filteredMembers = useMemo(() => {
    return teamMembers.filter(m => {
      const matchesSearch = 
        m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = activeFilter === "ALL" || m.groupName === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [teamMembers, searchQuery, activeFilter]);

  const groups = useMemo(() => {
    const groupMap = new Map<string, typeof teamMembers>();
    filteredMembers.forEach(m => {
      if (!groupMap.has(m.groupName)) groupMap.set(m.groupName, []);
      groupMap.get(m.groupName)!.push(m);
    });
    
    // Sort groups hierarchically, then alphabetically
    return Array.from(groupMap.entries()).sort((a, b) => {
      const pA = getPriority(a[0]);
      const pB = getPriority(b[0]);
      if (pA !== pB) return pA - pB;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredMembers]);

  const allGroupNames = useMemo(() => {
    const names = new Set<string>();
    teamMembers.forEach(m => names.add(m.groupName));
    return Array.from(names).sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    });
  }, [teamMembers]);

  const toggleStatus = async (member: any, checked: boolean) => {
    try {
      const newStatus = checked ? 'active' : 'inactive';
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', member.id);
      
      if (error) throw error;
      toast.success(`${member.full_name || 'User'} is now ${newStatus}`);
      qc.invalidateQueries({ queryKey: ["team_profiles"] });
    } catch (err: any) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          variant="outline" 
          className={`rounded-full h-8 transition-all duration-300 ${
            activeFilter === "ALL" 
              ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-transparent shadow-md hover:from-orange-700 hover:to-amber-700 hover:shadow-lg" 
              : "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
          }`}
          onClick={() => setActiveFilter("ALL")}
        >
          ALL <span className="ml-2 bg-background/20 px-1.5 py-0.5 rounded-full text-[10px]">{teamMembers.length + bdoPartners.length}</span>
        </Button>
        {allGroupNames.map(g => {
          const count = teamMembers.filter(m => m.groupName === g).length;
          return (
            <Button 
              key={g}
              variant="outline" 
              className={`rounded-full h-8 transition-all duration-300 ${
                activeFilter === g 
                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-transparent shadow-md hover:from-orange-700 hover:to-amber-700 hover:shadow-lg" 
                  : "hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
              }`}
              onClick={() => setActiveFilter(g)}
            >
              {g} <span className="ml-2 bg-background/20 px-1.5 py-0.5 rounded-full text-[10px]">{count}</span>
            </Button>
          )
        })}

        <Button
          variant="outline"
          className={`rounded-full h-8 transition-all duration-300 ${
            activeFilter === "BDO PARTNERS"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-md hover:shadow-lg"
              : "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          }`}
          onClick={() => setActiveFilter("BDO PARTNERS")}
        >
          BDO PARTNERS <span className="ml-2 bg-emerald-500/20 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{bdoPartners.length}</span>
        </Button>
      </div>

      {/* Search and Add */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search employee, BDO partner, agency, etc..." 
            className="pl-9 bg-card rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="w-full sm:w-auto rounded-full border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-semibold"
            onClick={() => {
              setEditingBdo(null);
              setIsBdoDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5 text-emerald-600" /> Add BDO Partner
          </Button>

          <Button
            className="w-full sm:w-auto rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white border-transparent shadow-md hover:shadow-lg transition-all duration-300"
            onClick={() => {
              setEditingEmployee(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add User
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading team...
        </div>
      ) : (
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground bg-card rounded-xl border border-border/50">
              No employees found matching your filters.
            </div>
          ) : (
            groups.map(([groupName, members]) => (
              <div key={groupName} className="bg-card rounded-2xl border border-border/50 overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-border/50 bg-muted/20">
                  <div>
                    <h3 className="font-semibold tracking-wide text-muted-foreground">{groupName}</h3>
                    <p className="text-xl font-bold">{members.length} members</p>
                  </div>
                  <Badge variant="secondary" className="px-4 py-1 text-xs tracking-wider bg-primary/10 text-primary uppercase">
                    {groupName}
                  </Badge>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {members.map(member => (
                    <div key={member.id} className="group relative flex gap-4 p-5 rounded-xl border border-border/50 bg-background shadow-sm hover:shadow-md transition-all hover:border-primary/20">
                      
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-terracotta hover:bg-terracotta/10 rounded-lg cursor-pointer transition-colors"
                            title="Change Employee Password"
                            onClick={() => {
                              setPasswordTargetEmployee(member);
                              setIsPasswordDialogOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-lg cursor-pointer"
                          title="Edit Employee"
                          onClick={() => {
                            setEditingEmployee(member);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>

                      <Avatar className="h-12 w-12 border-2 border-primary/10 font-bold">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/5 text-primary">
                          {member.full_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0 space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 pr-6">
                            <h4 className="font-semibold text-sm truncate">{member.full_name || "Unknown User"}</h4>
                            <Badge className={`h-5 px-1.5 text-[9px] uppercase font-bold tracking-wider ${getRoleGradient(member.role)}`} variant="outline">
                              {member.role === "crm" ? "CRM Team" : member.role === "manager" ? "Sales Head" : member.role === "employee" ? "Executive" : member.role.replace("_", " ")}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={member.status !== 'inactive'}
                              onCheckedChange={(c) => toggleStatus(member, c)}
                              className="scale-75 origin-left"
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {member.status === 'inactive' ? 'Inactive' : 'Active'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {member.manager_id && (() => {
                            const manager = teamMembers.find(m => m.id === member.manager_id);
                            return manager ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                <Users className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                                <span className="truncate">Reports to: <span className="font-medium">{manager.full_name || manager.email}</span></span>
                              </div>
                            ) : null;
                          })()}
                          {member.email && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate" title={member.email}>{member.email}</span>
                            </div>
                          )}
                          {member.job_title && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Briefcase className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{member.job_title}</span>
                            </div>
                          )}
                          {member.department && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Building className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{member.department}</span>
                            </div>
                          )}
                          {member.phone && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{member.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* OUTSOURCED BDO PARTNERS SECTION */}
          {(activeFilter === "ALL" || activeFilter === "BDO PARTNERS") && bdoPartners.length > 0 && (
            <div className="bg-card rounded-2xl border border-emerald-500/30 overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-border/50 bg-emerald-500/5">
                <div>
                  <h3 className="font-semibold tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Building className="h-4 w-4 text-emerald-600" /> OUTSOURCED BDO PARTNERS
                  </h3>
                  <p className="text-xl font-bold">{bdoPartners.length} channel partners</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="px-4 py-1 text-xs tracking-wider bg-emerald-500/10 text-emerald-700 border-emerald-500/30 uppercase font-semibold">
                    Channel Partners
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 font-semibold"
                    onClick={() => {
                      setEditingBdo(null);
                      setIsBdoDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add BDO
                  </Button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bdoPartners
                  .filter((bdo: any) => 
                    !searchQuery.trim() || 
                    bdo.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bdo.agency_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bdo.bdo_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    bdo.phone?.includes(searchQuery)
                  )
                  .map((bdo: any) => (
                    <div key={bdo.id} className="group relative flex gap-4 p-5 rounded-xl border border-emerald-500/20 bg-background shadow-sm hover:shadow-md transition-all hover:border-emerald-500/40">
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg cursor-pointer"
                          title="Edit BDO Partner"
                          onClick={() => {
                            setEditingBdo(bdo);
                            setIsBdoDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-emerald-600" />
                        </Button>
                      </div>

                      <Avatar className="h-12 w-12 border-2 border-emerald-500/20 font-bold">
                        <AvatarFallback className="bg-emerald-500/10 text-emerald-600">
                          {bdo.name?.charAt(0)?.toUpperCase() || "B"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1 pr-6">
                            <h4 className="font-semibold text-sm truncate">{bdo.name}</h4>
                            {bdo.bdo_code && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                                {bdo.bdo_code}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Switch
                              checked={bdo.is_active !== false}
                              onCheckedChange={(c) => toggleBdoStatus(bdo, c)}
                              className="scale-75 origin-left"
                            />
                            <span className="text-xs font-medium text-muted-foreground">
                              {bdo.is_active === false ? "Inactive" : "Active Partner"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          {bdo.agency_name && (
                            <div className="flex items-center gap-2">
                              <Building className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              <span className="truncate font-medium text-foreground">{bdo.agency_name}</span>
                            </div>
                          )}
                          {bdo.commission_rate !== undefined && (
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                              <Briefcase className="h-3.5 w-3.5 shrink-0" />
                              <span>{bdo.commission_rate}% Incentive Commission</span>
                            </div>
                          )}
                          {bdo.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate font-mono">{bdo.phone}</span>
                            </div>
                          )}
                          {bdo.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{bdo.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <EmployeeFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        employee={editingEmployee}
        teamMembers={teamMembers}
      />

      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
        employee={passwordTargetEmployee}
      />

      <AddEditBdoDialog
        open={isBdoDialogOpen}
        onOpenChange={setIsBdoDialogOpen}
        bdo={editingBdo}
      />
    </div>
  );
}
