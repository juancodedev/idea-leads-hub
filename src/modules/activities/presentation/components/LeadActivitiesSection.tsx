"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity } from "../../domain/entities/Activity";
import { useActivityRepository } from "@/ui/providers/RepositoryProvider";
import { ActivityList } from "./ActivityList";
import { ActivityForm } from "../forms/ActivityForm";
import { ActivitySchemaType } from "../../infrastructure/schemas/ActivitySchema";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/components/dialog";
import { Button } from "@/ui/components/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/ui/components/skeleton";

interface LeadActivitiesSectionProps {
  leadId: string;
}

export function LeadActivitiesSection({ leadId }: LeadActivitiesSectionProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const activityRepository = useActivityRepository();

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await activityRepository.getForLead(leadId);
      setActivities(data);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setIsLoading(false);
    }
  }, [leadId, activityRepository]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleSubmit = async (data: ActivitySchemaType) => {
    setIsSubmitting(true);
    try {
      await activityRepository.create(data);
      toast.success("Actividad registrada");
      setIsFormOpen(false);
      fetchActivities();
    } catch (error) {
      toast.error("Error al registrar actividad");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && activities.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Actividades y Seguimiento</h3>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Nueva Actividad</DialogTitle>
            </DialogHeader>
            <ActivityForm 
              leadId={leadId} 
              onSubmit={handleSubmit} 
              isLoading={isSubmitting} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <ActivityList 
        activities={activities} 
        onUpdate={fetchActivities} 
      />
    </div>
  );
}
