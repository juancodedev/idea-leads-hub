"use client";

import { useState } from "react";
import { Upload, X, FileIcon, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/ui/components/button";
import { uploadFileAction } from "../../infrastructure/actions/storageActions";
import { IdeaAttachment } from "../../domain/entities/Idea";
import { toast } from "sonner";

interface FileUploaderProps {
  value: IdeaAttachment[];
  onChange: (value: IdeaAttachment[]) => void;
}

export function FileUploader({ value, onChange }: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    const newAttachments = [...value];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const result = await uploadFileAction(formData);

        if (result.error) {
          toast.error(`Error al subir ${file.name}`, {
            description: result.error,
          });
        } else if (result.file) {
          newAttachments.push(result.file);
        }
      } catch (error) {
        toast.error(`Error inesperado al subir ${file.name}`);
        console.error(error);
      }
    }

    onChange(newAttachments);
    setIsUploading(false);
    // Reset input
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    const newFiles = [...value];
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {value.map((file, index) => (
            <div 
              key={index} 
              className="group relative flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:bg-accent/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-none">
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatSize(file.size)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <a 
                  href={file.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="rounded-full p-2 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                  title="Ver archivo"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Eliminar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          disabled={isUploading}
        />
        <div className="flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 transition-all hover:bg-muted/40 hover:border-muted-foreground/50">
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground animate-pulse">
                Subiendo archivos...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 rounded-full bg-background p-3 shadow-sm">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">
                Arrastra archivos o haz clic para subir
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Soporta múltiples archivos
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
