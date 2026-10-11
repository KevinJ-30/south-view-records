import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImageIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { toast } from "@/components/ui/toast";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const LandingPage = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("image", file);

      const response = await fetch("/api/image", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        try {
          const result = (await response.json()) as {
            error: string;
          };

          throw new Error(result.error);
        } catch {
          throw new Error("Image to text request failed.");
        }
      }

      const payload = (await response.json()) as {
        text: string;
      };

      return payload.text;
    },
    onSuccess: () => {
      toast.add({
        type: "success",
        title: "Text extracted",
        description: "The image was read successfully.",
      });
    },
    onError: (error) => {
      toast.add({
        type: "error",
        title: "Could not read the image",
        description: error.message,
      });
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openFilePicker() {
    inputRef.current?.click();
  }

  function selectFile(next: File | undefined) {
    if (!next) return;

    if (!next.type.startsWith("image/")) {
      toast.add({
        type: "error",
        title: "Choose an image",
        description: "PNG, JPG, GIF, and WebP files are supported.",
      });
      return;
    }

    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    mutation.reset();
  }

  function clearFile() {
    setFile(null);
    setPreviewUrl(null);
    mutation.reset();
    if (inputRef.current) inputRef.current.value = "";
  }

  const attachmentState = mutation.isPending ? "processing" : mutation.isError ? "error" : "done";

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-10">
      <Card className="w-full">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={file ? `Preview of ${file.name}` : "Selected image"}
            className="max-h-72 w-full object-cover"
          />
        ) : null}
        <CardHeader>
          <CardTitle>Image to text</CardTitle>
          <CardDescription>Upload a picture and extract the words in it.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {file ? (
            <Attachment state={attachmentState} className="w-full">
              <AttachmentMedia variant="image">
                {previewUrl ? <img src={previewUrl} alt="" /> : <ImageIcon />}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
                <AttachmentDescription>
                  {mutation.isPending
                    ? "Reading image…"
                    : mutation.isError
                      ? "Could not read this image"
                      : formatBytes(file.size)}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label="Remove image"
                  disabled={mutation.isPending}
                  onClick={clearFile}
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ) : (
            <Attachment
              state="idle"
              className="w-full"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files?.[0]);
              }}
            >
              <AttachmentMedia>
                <ImageIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>Choose an image</AttachmentTitle>
                <AttachmentDescription>PNG, JPG, GIF, or WebP</AttachmentDescription>
              </AttachmentContent>
              <AttachmentTrigger aria-label="Choose an image" onClick={openFilePicker} />
            </Attachment>
          )}

          <div className="flex flex-col gap-2">
            <p className="font-medium">Extracted text</p>
            <div
              aria-live="polite"
              className="min-h-24 rounded-xl bg-muted px-4 py-3 whitespace-pre-wrap text-muted-foreground"
            >
              {mutation.data ? (
                <span className="text-foreground">{mutation.data}</span>
              ) : mutation.isPending ? (
                "Reading the image…"
              ) : (
                "Extracted text will appear here."
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {file ? (
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={openFilePicker}
            >
              Change image
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!file || mutation.isPending}
            onClick={() => {
              if (file) mutation.mutate(file);
            }}
          >
            {mutation.isPending ? <Loader2Icon className="animate-spin" /> : null}
            Extract text
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
};
