"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Profile } from "@/core/domain/Profile";
import { updateProfileAction, uploadAvatarAction } from "@/modules/shared/infrastructure/actions/profileActions";
import { Button } from "@/ui/components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/components/form";
import { Input } from "@/ui/components/input";
import { Textarea } from "@/ui/components/textarea";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/components/avatar";
import { User, Camera, Loader2 } from "lucide-react";

const profileSchema = z.object({
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
  bio: z.string().max(160, "La biografía no puede superar los 160 caracteres").optional(),
  avatarUrl: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData: Profile;
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: initialData.fullName || "",
      companyName: initialData.companyName || "",
      jobTitle: initialData.jobTitle || "",
      phone: initialData.phone || "",
      website: initialData.website || "",
      bio: initialData.bio || "",
      avatarUrl: initialData.avatarUrl || "",
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecciona una imagen");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const publicUrl = await uploadAvatarAction(formData);
      form.setValue("avatarUrl", publicUrl);
      if (isMounted.current) {
        toast.success("Foto de perfil subida correctamente");
      }
    } catch (error: any) {
      if (isMounted.current) {
        toast.error("Error al subir la foto: " + error.message);
      }
    } finally {
      if (isMounted.current) {
        setIsUploading(false);
      }
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);
    try {
      await updateProfileAction(data);
      if (isMounted.current) {
        toast.success("Perfil actualizado correctamente");
      }
    } catch (error: any) {
      if (isMounted.current) {
        toast.error("Error al actualizar el perfil: " + error.message);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tu Perfil</CardTitle>
          <CardDescription>
            Gestiona tu información personal y cómo te ven los demás.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="flex items-center gap-x-6">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-2 border-muted transition-all group-hover:border-primary">
                    <AvatarImage src={form.watch("avatarUrl")} className="object-cover" />
                    <AvatarFallback className="bg-muted">
                      <User className="h-12 w-12 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8 text-white" />
                        <span className="text-[10px] text-white font-medium mt-1">CAMBIAR</span>
                      </>
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium">Foto de perfil</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Haz clic en el avatar para subir una nueva foto.<br />
                    JPG, PNG o GIF. Máximo 2MB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="+34 600 000 000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Mi Empresa S.L." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <Input placeholder="CEO / Fundador" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Sitio Web</FormLabel>
                      <FormControl>
                        <Input placeholder="https://tuweb.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Biografía</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Cuéntanos un poco sobre ti..." 
                          className="resize-none" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Máximo 160 caracteres.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Guardar cambios"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
