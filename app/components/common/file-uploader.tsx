import { IconCircleCheckFilled, IconCloudUpload, IconLoader } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Sentry } from "~/integrations/sentry";

export function FileUploader() {
  const navigate = useNavigate();

  const [files, setFiles] = useState<Array<File>>([]);
  const [uploadStatus, setUploadStatus] = useState({
    uploading: false,
    success: false,
    message: "",
  });

  async function handleFilesUpload(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.preventDefault();
    try {
      setUploadStatus((s) => s);
      if (files.length === 0) {
        setUploadStatus((s) => ({ ...s, message: "No file selected." }));
        return;
      }

      setUploadStatus((s) => ({ ...s, uploading: true }));

      // Get presigned URL
      let uploadedFilesCount = 0;
      for (const file of files) {
        const response = await fetch("/api/get-upload-url", {
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
        const receiptUpload = await fetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: file.name, s3Key }),
        });

        if (!receiptUpload.ok) {
          throw new Error(`Error saving ${file.name}. Please contact support.`);
        }

        uploadedFilesCount++;
      }

      await navigate(".", { replace: true, preventScrollReset: true });
      setUploadStatus((s) => ({
        ...s,
        success: true,
        message: `Uploaded ${uploadedFilesCount} out of ${files.length} selected files.`,
      }));
      setFiles([]);
    } catch (error) {
      Sentry.captureException(error);
      setUploadStatus(() => ({
        uploading: false,
        success: false,
        message:
          error instanceof Error
            ? error.message.toLowerCase().includes("failed to fetch")
              ? "Network error. Please file a bug report."
              : error.message
            : "Unknown error",
      }));
    } finally {
      setUploadStatus((s) => s);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start gap-2 sm:gap-4">
        <div className="flex h-10 w-auto items-center">
          <Label htmlFor="file" className="sr-only">
            Files
          </Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept="image/*,application/pdf,image/heic"
            className="hover:bg-muted cursor-pointer"
            disabled={uploadStatus.uploading || uploadStatus.success}
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                setFiles(Array.from(files));
              }
            }}
            multiple
          />
        </div>
        {uploadStatus.success ? (
          <div className="text-success flex h-10 items-center gap-1">
            <span className="text-sm font-medium">{uploadStatus.message}</span>
            <IconCircleCheckFilled className="size-5" />
          </div>
        ) : (
          <Button
            onClick={handleFilesUpload}
            disabled={uploadStatus.uploading || !files}
            variant="outline"
            type="button"
            className="flex h-10 w-full items-center gap-2 shadow-none sm:h-10 sm:w-auto"
          >
            {uploadStatus.uploading ? (
              <IconLoader className="size-4 animate-spin" />
            ) : (
              <>
                <span>Upload</span>
                <IconCloudUpload className="size-4" />
              </>
            )}
          </Button>
        )}
      </div>
      {uploadStatus.message && !uploadStatus.success ? (
        <p className={"text-destructive mt-0.5 text-xs font-medium"} role="alert" id="upload-error">
          {uploadStatus.message}
        </p>
      ) : null}
    </>
  );
}
