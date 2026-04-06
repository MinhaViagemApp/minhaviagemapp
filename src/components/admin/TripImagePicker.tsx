import { useEffect, useMemo } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateTripImageSelection } from "@/lib/trip-image-upload";

interface TripImagePickerProps {
  disabled?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}

export function TripImagePicker({ disabled = false, files, onChange }: TripImagePickerProps) {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  const handleSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    const mergedFiles = [...files, ...nextFiles];
    const validationError = validateTripImageSelection(mergedFiles);

    if (validationError) {
      console.error("Erro de validação das imagens:", validationError);
      toast.error(validationError);
      window.alert(validationError);
      event.target.value = "";
      return;
    }

    console.log("Imagens selecionadas para a viagem:", mergedFiles.map((file) => file.name));
    onChange(mergedFiles);
    event.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Imagens da viagem</Label>
        <label className="block cursor-pointer rounded-md border border-input bg-secondary/50 px-4 py-3 text-sm transition-colors hover:bg-secondary">
          <input
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            className="hidden"
            disabled={disabled}
            multiple
            type="file"
            onChange={handleSelection}
          />
          <span className="flex items-center gap-2 text-foreground">
            <ImagePlus className="h-4 w-4" />
            Selecionar até 10 imagens (JPG ou PNG)
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          As imagens ficam salvas no backend e apenas as URLs são gravadas na viagem.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{files.length} imagem(ns) pronta(s) para envio</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="group relative overflow-hidden rounded-lg border border-border/50 bg-background">
                <img src={previews[index]} alt={file.name} className="h-28 w-full object-cover" loading="lazy" />
                <Button
                  className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                  disabled={disabled}
                  size="icon"
                  type="button"
                  variant="secondary"
                  onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <div className="truncate px-2 py-1 text-xs text-muted-foreground">{file.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}