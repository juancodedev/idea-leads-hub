"use client";

import React from "react";
import { Users, Lightbulb, CheckSquare, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/card";

interface DashboardStatsProps {
  activeLeads: number;
  wonLeads: number;
  pendingActivities: number;
  activeIdeas: number;
}

export function DashboardStats({ 
  activeLeads, 
  wonLeads, 
  pendingActivities, 
  activeIdeas 
}: DashboardStatsProps) {
  const stats = [
    {
      title: "Leads Activos",
      value: activeLeads,
      icon: Users,
      description: "Prospectos en seguimiento",
      color: "text-blue-500",
    },
    {
      title: "Leads Ganados",
      value: wonLeads,
      icon: Target,
      description: "Conversiones exitosas",
      color: "text-green-500",
    },
    {
      title: "Tareas Pendientes",
      value: pendingActivities,
      icon: CheckSquare,
      description: "Actividades por completar",
      color: "text-orange-500",
    },
    {
      title: "Ideas Activas",
      value: activeIdeas,
      icon: Lightbulb,
      description: "Proyectos en incubación",
      color: "text-yellow-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
