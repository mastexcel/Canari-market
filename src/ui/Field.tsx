"use client";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-xl border border-gris-300 bg-white px-3.5 text-[15px] text-anthracite-900 placeholder:text-anthracite-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 aria-[invalid=true]:border-alerte-700 disabled:bg-gris-100";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
  optional?: boolean;
}

function FieldShell({ label, hint, error, id, children, optional }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-anthracite-800">
        {label} {optional && <span className="font-normal text-anthracite-500">(facultatif)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-alerte-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-anthracite-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null; optional?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, optional, className, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid} optional={optional}>
      <input
        ref={ref}
        id={fid}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined}
        className={cn(control, "h-12", className)}
        {...rest}
      />
    </FieldShell>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string | null; optional?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, optional, className, id, children, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid} optional={optional}>
      <select ref={ref} id={fid} aria-invalid={!!error || undefined} className={cn(control, "h-12 appearance-none bg-[length:16px] pr-9", className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string | null; optional?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, optional, className, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fid} optional={optional}>
      <textarea ref={ref} id={fid} aria-invalid={!!error || undefined} className={cn(control, "min-h-24 py-3", className)} {...rest} />
    </FieldShell>
  );
});

export function Checkbox({ label, description, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-1", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-brand-600" {...rest} />
      <span className="text-sm text-anthracite-800">
        {label}
        {description && <span className="mt-0.5 block text-xs text-anthracite-600">{description}</span>}
      </span>
    </label>
  );
}

/** Choix visuels (radio) en cartes — utilisé pour portions, modes de livraison… */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  aside,
  disabled,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-white p-3 transition-colors",
        checked ? "border-brand-600 bg-brand-50" : "border-gris-200 hover:border-gris-300",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} className="size-5 accent-brand-600" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-anthracite-900">{title}</span>
        {description && <span className="block text-sm text-anthracite-600">{description}</span>}
      </span>
      {aside}
    </label>
  );
}
