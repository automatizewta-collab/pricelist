"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Upload, Loader2, Check, X } from "lucide-react";

interface ImageUploaderProps {
  codigo: string;
  nome: string;
  onUploadSuccess?: () => void;
}

const TARGET_SIZE = 500;

export default function ImageUploader({
  codigo,
  nome,
  onUploadSuccess,
}: ImageUploaderProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setPreview(null);
    setBase64(null);
    setError(null);
    setSuccess(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setSuccess(false);
      const file = e.target.files?.[0];
      if (!file) return;

      // Valida tipo
      if (file.type !== "image/png" && file.type !== "image/jpeg") {
        setError("Apenas arquivos PNG são aceitos.");
        return;
      }

      // Valida tamanho (10MB antes do processamento)
      if (file.size > 10 * 1024 * 1024) {
        setError("Arquivo muito grande. Máximo: 10MB.");
        return;
      }

      // Redimensiona com Canvas
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = TARGET_SIZE;
          canvas.height = TARGET_SIZE;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setError("Erro ao criar canvas de processamento.");
            return;
          }

          // Fundo branco para imagens com transparência
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

          // Calcula dimensões mantendo proporção (cover)
          const scale = Math.max(
            TARGET_SIZE / img.width,
            TARGET_SIZE / img.height
          );
          const scaledW = img.width * scale;
          const scaledH = img.height * scale;
          const offsetX = (TARGET_SIZE - scaledW) / 2;
          const offsetY = (TARGET_SIZE - scaledH) / 2;

          ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

          // Exporta como PNG base64
          const dataUrl = canvas.toDataURL("image/png");
          setPreview(dataUrl);
          setBase64(dataUrl);
        };
        img.onerror = () => {
          setError("Erro ao carregar a imagem.");
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!base64) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/produtos/${encodeURIComponent(codigo)}/imagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagem: base64 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao fazer upload");
      }

      setSuccess(true);
      if (onUploadSuccess) {
        setTimeout(() => {
          onUploadSuccess();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  }, [base64, codigo, onUploadSuccess]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-12 min-w-[48px] text-base gap-2 border-wta-red/30 text-wta-red hover:bg-wta-red/10 hover:text-wta-red"
        >
          <Camera className="h-5 w-5" />
          <span className="hidden sm:inline">Alterar Foto</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            📷 Alterar Foto - {codigo}
          </DialogTitle>
        </DialogHeader>
        <p className="text-base text-gray-600">{nome}</p>

        <div className="space-y-4">
          {/* Input de arquivo */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,image/png"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            className="w-full h-14 text-lg gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-5 w-5" />
            Selecionar Imagem PNG
          </Button>

          {/* Preview */}
          {preview && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-48 h-48 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-sm text-gray-500">
                Imagem redimensionada para {TARGET_SIZE}×{TARGET_SIZE}px
              </p>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-base">
              <X className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Sucesso */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-base">
              <Check className="h-5 w-5 flex-shrink-0" />
              Imagem salva com sucesso!
            </div>
          )}

          {/* Botão de upload */}
          {base64 && !success && (
            <Button
              className="w-full h-14 text-lg bg-wta-red hover:bg-wta-red/90 text-white"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Salvar Imagem
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
