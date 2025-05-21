import { useField } from "@rvf/react-router";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { JSX, useId, useState } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

function FieldError({ id, error }: { id: string; error?: string | null }) {
  if (!error) return null;
  return (
    <span aria-live="polite" id={`${id}-error`} className="ml-1 mt-1 text-xs font-medium text-destructive">
      {error ? <span>{error}</span> : null}
    </span>
  );
}

function FieldDescription({ id, description }: { id: string; description?: string }) {
  if (!description) return null;
  return (
    <p id={`${id}-description`} className="ml-1 mt-1 text-xs text-muted-foreground">
      {description}
    </p>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  description?: string;
  isCurrency?: boolean;
  hideLabel?: boolean;
}
export function FormField({
  isCurrency = false,
  hideLabel = false,
  name,
  label,
  className,
  description,
  ...props
}: FieldProps) {
  const fallbackId = useId();
  const field = useField(name);
  const [type, setType] = useState(props.type);

  const id = props.id ?? fallbackId;
  const error = field.error();

  return (
    <div className={cn("relative w-full")}>
      <Label
        htmlFor={id}
        className={cn(
          hideLabel ? "sr-only" : "mb-1.5",
          error && "text-destructive",
          props.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span>{label}</span>
        <span
          className={cn(
            "ml-1 inline-block font-normal",
            props.required || error ? "text-destructive" : "text-muted-foreground",
            !props.required && "text-xs",
          )}
        >
          {props.required ? "*" : "(optional)"}
        </span>
      </Label>
      <Input
        id={id}
        inputMode={isCurrency ? "decimal" : props.inputMode}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-errormessage={error ? `${id}-error` : props["aria-errormessage"]}
        aria-describedby={description ? `${id}-description` : props["aria-describedby"]}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50", isCurrency && "pl-7", className)}
        {...field.getInputProps()}
        onBlur={(e) => {
          if (isCurrency) {
            const value = parseFloat(e.currentTarget.value);
            if (isNaN(value)) {
              e.currentTarget.value = "";
            } else {
              e.currentTarget.value = value.toFixed(2);
            }
          }
          props.onBlur?.(e);
        }}
        {...props}
        type={type}
      />
      {isCurrency ? (
        <span className="pointer-events-none absolute left-2 top-9 text-muted-foreground">
          <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
        </span>
      ) : null}
      {props.type === "password" ? (
        <button
          type="button"
          className="absolute right-0 top-0 rounded p-2 text-xs text-muted-foreground transition hover:underline focus:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/50"
          onClick={() => setType((t) => (t === "password" ? "text" : "password"))}
        >
          {type === "password" ? "Show" : "Hide"}
        </button>
      ) : null}
      <FieldDescription id={id} description={description} />
      <FieldError id={id} error={error} />
    </div>
  );
}
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label: string;
  description?: string;
  hideLabel?: boolean;
}
export function FormTextarea({ hideLabel = false, name, label, className, description, ...props }: FormTextareaProps) {
  const fallbackId = useId();
  const field = useField(name);
  const error = field.error();
  const id = props.id ?? fallbackId;

  return (
    <div className={cn("relative w-full")}>
      <Label
        htmlFor={id}
        className={cn(
          hideLabel ? "sr-only" : "mb-1.5",
          error && "text-destructive",
          props.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span>{label}</span>
        <span
          className={cn(
            "ml-1 inline-block font-normal",
            props.required ? "text-destructive" : "text-xs text-muted-foreground",
          )}
        >
          {props.required ? "*" : "(optional)"}
        </span>
      </Label>
      <Textarea
        id={id}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-errormessage={error ? `${id}-error` : props["aria-errormessage"]}
        aria-describedby={description ? `${id}-description` : props["aria-describedby"]}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50", className)}
        {...field.getInputProps()}
        {...props}
      />
      <FieldDescription id={id} description={description} />
      <FieldError id={id} error={error} />
    </div>
  );
}

export interface FormSelectProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: string;
  label: string;
  placeholder: string;
  description?: string;
  required?: boolean;
  id?: string;
  options?: Array<{ value: string | number | null; label: string | JSX.Element | null }>;
  hideLabel?: boolean;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
}

export function FormSelect(props: FormSelectProps) {
  const { name, label, placeholder, options, hideLabel, divProps, ...rest } = props;
  const field = useField(name);
  const { onChange, ...input } = field.getInputProps({});
  const fallbackId = useId();
  const error = field.error();
  const id = props.id ?? fallbackId;

  return (
    <div {...divProps} className={cn("relative w-full", divProps?.className)}>
      <Label
        htmlFor={id}
        className={cn(
          hideLabel ? "sr-only" : "mb-1",
          error && "text-destructive",
          props.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span>{label}</span>
        <span
          className={cn(
            "ml-1 inline-block font-normal",
            props.required ? "text-destructive" : "text-xs text-muted-foreground",
          )}
        >
          {props.required ? "*" : "(optional)"}
        </span>
      </Label>
      <Select {...input} value={String(input.value)} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          {...rest}
          aria-label={placeholder}
          className={cn(error && "border-destructive focus-visible:ring-destructive/50", rest.className)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options && options.length === 0 ? (
            // @ts-expect-error see https://github.com/radix-ui/primitives/issues/1569#issuecomment-1567414323
            <SelectItem value={null} disabled>
              No options
            </SelectItem>
          ) : (
            !props.required && (
              // @ts-expect-error see https://github.com/radix-ui/primitives/issues/1569#issuecomment-1567414323
              <SelectItem value={null} className="text-muted-foreground/60 focus:text-muted-foreground/60">
                {placeholder}
              </SelectItem>
            )
          )}
          {options
            ? options.map((o) => {
                if (o.value === null || o.label === null) return null;

                return (
                  <SelectItem key={o.value} value={o.value.toString()}>
                    {o.label}
                  </SelectItem>
                );
              })
            : props.children}
        </SelectContent>
        <FieldDescription id={id} description={props.description} />
        <FieldError id={id} error={error} />
      </Select>
    </div>
  );
}
