import { supabase } from "@/integrations/supabase/client";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];

const sanitizeFileName = (fileName: string) =>
  fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

const hasAllowedExtension = (fileName: string) =>
  ALLOWED_IMAGE_EXTENSIONS.some((extension) => fileName.toLowerCase().endsWith(extension));

export const validateTripImageSelection = (files: File[]) => {
  if (files.length > 10) {
    return "Máximo de 10 imagens por viagem.";
  }

  const invalidFile = files.find(
    (file) => !ALLOWED_IMAGE_TYPES.has(file.type) && !hasAllowedExtension(file.name)
  );

  if (invalidFile) {
    return `Arquivo inválido: ${invalidFile.name}. Use apenas JPG ou PNG.`;
  }

  return null;
};

export const uploadTripImages = async ({
  files,
  companyId,
}: {
  files: File[];
  companyId: string;
}) => {
  const validationError = validateTripImageSelection(files);
  if (validationError) {
    throw new Error(validationError);
  }

  if (files.length === 0) return [] as string[];

  const urls: string[] = [];

  for (const file of files) {
    const filePath = `${companyId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

    console.log("Enviando imagem para o storage:", {
      bucket: "trip-images",
      fileName: file.name,
      filePath,
      size: file.size,
      type: file.type,
    });

    const { error } = await supabase.storage.from("trip-images").upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

    if (error) {
      console.error("Erro Supabase (upload imagem):", error);
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from("trip-images").getPublicUrl(filePath);

    if (!data.publicUrl) {
      const publicUrlError = `Não foi possível obter a URL pública da imagem ${file.name}.`;
      console.error(publicUrlError);
      throw new Error(publicUrlError);
    }

    urls.push(data.publicUrl);
  }

  console.log("Upload concluído com sucesso:", urls);

  return urls;
};