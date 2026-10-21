"use client";
import { useForm } from "react-hook-form";
import { useState, useId } from "react";
import { ApiFailure } from "@/lib/api";
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[];
  hint?: string;
  min?: number;
  max?: number;
};
export function DataForm({
  fields,
  onSubmit,
  submit = "Save changes",
  children,
}: {
  fields: Field[];
  onSubmit: (data: Record<string, string>) => Promise<unknown>;
  submit?: string;
  children?: React.ReactNode;
}) {
  const id = useId(),
    [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
    reset,
  } = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, f.value ?? ""]),
    ),
  });
  return (
    <form
      className="form"
      onSubmit={handleSubmit(async (d) => {
        setMessage("");
        try {
          await onSubmit(d);
          setMessage("Saved successfully.");
          if (submit === "Send enquiry") reset();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Please try again.");
          if (e instanceof ApiFailure)
            Object.entries(e.fields).forEach(([name, err]) =>
              setError(name, { message: err.join(" ") }),
            );
        }
      })}
    >
      {fields.map((f) => (
        <div className="field-row" key={f.name}>
          <label htmlFor={id + f.name}>{f.label}</label>
          {f.options ? (
            <select
              id={id + f.name}
              className="field"
              {...register(f.name, { required: f.required })}
            >
              {!f.value && <option value="">Select…</option>}
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              id={id + f.name}
              className="field"
              rows={4}
              {...register(f.name, { required: f.required })}
            />
          ) : (
            <input
              id={id + f.name}
              className="field"
              type={f.type || "text"}
              min={f.min}
              max={f.max}
              autoComplete={
                f.type === "password"
                  ? "new-password"
                  : f.type === "email"
                    ? "email"
                    : undefined
              }
              {...register(f.name, { required: f.required })}
            />
          )}{" "}
          {f.hint && <small>{f.hint}</small>}
          {errors[f.name] && (
            <p role="alert">
              {errors[f.name]?.message || "This field is required."}
            </p>
          )}
        </div>
      ))}
      {children}
      <p role="status" className="form-feedback">
        {message}
      </p>
      <button className="button btn primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submit} <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
