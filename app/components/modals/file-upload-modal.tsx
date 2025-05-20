import { IconCircleCheckFilled, IconCircleXFilled, IconCloudUpload, IconLoader } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";
import { Sentry } from "~/integrations/sentry";
import { cn } from "~/lib/utils";

type UploadState = {
  status: "idle" | "uploading" | "success" | "error";
  message: string;
};
const initialState: UploadState = {
  status: "idle",
  message: "",
};

export function FileUploadModal() {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [{ status, message }, setUploadStatus] = useState(initialState);

  async function handleFilesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const { files } = e.target;

    try {
      setUploadStatus((s) => s);
      if (!files || files.length === 0) {
        setUploadStatus((s) => ({ ...s, message: "No file selected." }));
        return;
      }

      setUploadStatus((s) => ({ ...s, status: "uploading" }));

      // Get presigned URL
      let uploadedFilesCount = 0;
      for (const file of files) {
        // Check file size
        if (file.size > 5 * 1024 * 1024) {
          setUploadStatus((s) => ({
            ...s,
            status: "error",
            message: `${file.name} is too large. Max 5MB.`,
          }));
          return;
        }

        // Check file types
        if (!file.type.includes("image") && !file.type.includes("pdf") && !file.type.includes("heic")) {
          setUploadStatus((s) => ({
            ...s,
            status: "error",
            message: `${file.name} is not an image or PDF.`,
          }));
          return;
        }

        const response = await fetch("/resources/get-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
        });
        if (!response.ok) {
          throw new Error(`Error retrieving Amazon S3 URL for ${file.name}. Please contact support.`);
        }

        const { signedUrl, s3Key } = (await response.json()) as { signedUrl: string; s3Key: string };

        // Upload file to bucket
        const uploadResponse = await fetch(signedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Error uploading ${file.name}. Please contact support.`);
        }

        // Save receipt to database
        const receiptUpload = await fetch("/resources/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: file.name, s3Key }),
        });

        if (!receiptUpload.ok) {
          throw new Error(`Error saving ${file.name}. Please contact support.`);
        }

        uploadedFilesCount++;
      }

      navigate(".", { replace: true });
      setUploadStatus((s) => ({
        ...s,
        status: "success",
        message: `Uploaded ${uploadedFilesCount} out of ${files.length} file${files.length === 1 ? "" : "s"}.`,
      }));
    } catch (error) {
      Sentry.captureException(error);
      setUploadStatus(() => ({
        status: "error",
        message:
          error instanceof Error
            ? error.message.toLowerCase().includes("failed to fetch")
              ? "Network error. Please file a bug report."
              : error.message
            : "Unknown error. Please try again.",
      }));
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} type="button">
        <span>Upload Files</span>
        <IconCloudUpload className="size-4" />
      </Button>
      <DrawerDialog
        open={open}
        setOpen={(value) => {
          // Reset status when closing
          if (value === false) {
            setUploadStatus(initialState);
          }
          setOpen(value);
        }}
        title="Upload Files"
        description="After uploading, your files will be available to attach to reimbursement requests and transactions."
      >
        <p className="text-sm text-muted-foreground">
          If you don&apos;t see your file right away, please refresh the page.
        </p>
        <p className="text-sm text-muted-foreground">Images or PDF. 5MB max.</p>
        <fetcher.Form method="post" encType="multipart/form-data">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-40 w-full cursor-pointer place-items-center rounded-xl border-2 border-dashed border-primary text-primary"
          >
            <label>
              <span className="sr-only">Click to upload</span>
              <input
                ref={inputRef}
                type="file"
                name="file"
                hidden
                accept="image/*,application/pdf,image/heic"
                disabled={status === "uploading"}
                onChange={handleFilesUpload}
                multiple
              />
              {status === "uploading" ? (
                <IconLoader className="size-8 animate-spin" aria-hidden="true" />
              ) : (
                <IconCloudUpload className="size-8" aria-hidden="true" />
              )}
            </label>
          </button>
          <p
            className={cn(
              "mt-2 flex items-center justify-center gap-2 text-center text-sm sm:justify-start",
              status === "error" ? "text-destructive" : status === "success" ? "text-success" : "text-muted-foreground",
            )}
          >
            {status === "error" ? (
              <IconCircleXFilled className="text-destructive" />
            ) : (
              status === "success" && <IconCircleCheckFilled />
            )}
            {message}
          </p>
        </fetcher.Form>
        <DrawerDialogFooter>
          <Button onClick={() => setOpen(false)} type="button">
            Close
          </Button>
        </DrawerDialogFooter>
      </DrawerDialog>
    </>
  );
}
