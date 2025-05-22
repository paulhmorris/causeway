import { FormScope, useField, ValueOfInputType } from "@rvf/react-router";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { ComponentPropsWithRef, forwardRef, JSX, useId, useState } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

function FieldError({ id, error }: { id: string; error?: string | null }) {
  if (!error) return null;
  return (
    <span aria-live="polite" id={`${id}-error`} className="text-destructive mt-1 ml-1 text-xs font-medium">
      {error ? <span>{error}</span> : null}
    </span>
  );
}

function FieldDescription({ id, description }: { id: string; description?: string }) {
  if (!description) return null;
  return (
    <p id={`${id}-description`} className="text-muted-foreground mt-1 ml-1 text-xs">
      {description}
    </p>
  );
}

type BaseFieldProps = Omit<ComponentPropsWithRef<"input">, "type">;
interface FieldProps<Type extends string> extends BaseFieldProps {
  scope: FormScope<ValueOfInputType<Type> | undefined>;
  label: string;
  type?: Type;
  description?: string;
  isCurrency?: boolean;
  hideLabel?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FieldProps<string>>(
  ({ scope, label, className, description, hideLabel = false, isCurrency = false, type: _type, ...props }, ref) => {
    const fallbackId = useId();
    const field = useField(scope);
    const [type, setType] = useState(_type);

    const inputId = props.id ?? fallbackId;
    const error = field.error();

    return (
      <div className={cn("relative w-full")}>
        <Label
          htmlFor={inputId}
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
          {...field.getInputProps({
            ref,
            type,
            id: inputId,
            inputMode: isCurrency ? "decimal" : props.inputMode,
            "aria-invalid": error ? true : props["aria-invalid"],
            "aria-errormessage": error ? `${inputId}-error` : props["aria-errormessage"],
            "aria-describedby": description ? `${inputId}-description` : props["aria-describedby"],
            className: cn(
              error && "border-destructive focus-visible:ring-destructive/50",
              isCurrency && "pl-7",
              className,
            ),
            onBlur: (e) => {
              if (isCurrency) {
                const value = parseFloat(e.currentTarget.value);
                if (isNaN(value)) {
                  e.currentTarget.value = "";
                } else {
                  e.currentTarget.value = value.toFixed(2);
                }
              }
              props.onBlur?.(e);
            },
            ...props,
          })}
        />
        {isCurrency ? (
          <span className="text-muted-foreground pointer-events-none absolute top-9 left-2">
            <IconCurrencyDollar className="text-muted-foreground h-4 w-4" strokeWidth={2.5} />
          </span>
        ) : null}
        {_type === "password" ? (
          <button
            type="button"
            className="text-muted-foreground focus-visible:ring-primary/50 absolute top-0 right-0 rounded p-2 text-xs transition hover:underline focus:outline-hidden focus-visible:ring-3"
            onClick={() => setType((t) => (t === "password" ? "text" : "password"))}
          >
            {type === "password" ? "Show" : "Hide"}
          </button>
        ) : null}
        <FieldDescription id={inputId} description={description} />
        <FieldError id={inputId} error={error} />
      </div>
    );
  },
);

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  scope: FormScope<string | undefined>;
  label: string;
  description?: string;
  hideLabel?: boolean;
}
export function FormTextarea({ hideLabel = false, scope, label, className, description, ...props }: FormTextareaProps) {
  const fallbackId = useId();
  const field = useField(scope);
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
            props.required ? "text-destructive" : "text-muted-foreground text-xs",
          )}
        >
          {props.required ? "*" : "(optional)"}
        </span>
      </Label>
      <Textarea
        {...field.getInputProps({
          id: id,
          "aria-invalid": error ? true : props["aria-invalid"],
          "aria-errormessage": error ? `${id}-error` : props["aria-errormessage"],
          "aria-describedby": description ? `${id}-description` : props["aria-describedby"],
          className: cn(error && "border-destructive focus-visible:ring-destructive/50", className),
          ...props,
        })}
      />
      <FieldDescription id={id} description={description} />
      <FieldError id={id} error={error} />
    </div>
  );
}

export interface FormSelectProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  scope: FormScope<string | number | undefined>;
  label: string;
  placeholder: string;
  description?: string;
  required?: boolean;
  options?: Array<{ value: string | number | null; label: string | JSX.Element | null }>;
  hideLabel?: boolean;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
}

export function FormSelect(props: FormSelectProps) {
  const { scope, label, placeholder, options, hideLabel, divProps, ...rest } = props;
  const field = useField(scope);
  const { onChange, ...input } = field.getControlProps();
  const selectId = useId();
  const error = field.error();

  return (
    <div {...divProps} className={cn("relative w-full", divProps?.className)}>
      <Label
        htmlFor={selectId}
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
            props.required ? "text-destructive" : "text-muted-foreground text-xs",
          )}
        >
          {props.required ? "*" : "(optional)"}
        </span>
      </Label>
      <Select {...input} value={String(input.value)} onValueChange={onChange}>
        <SelectTrigger
          id={selectId}
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
        <FieldDescription id={selectId} description={props.description} />
        <FieldError id={selectId} error={error} />
      </Select>
    </div>
  );
}
