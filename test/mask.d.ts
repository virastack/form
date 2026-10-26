// The part of @virastack/mask v2 the combined test uses. Replace with the real package once v2 is on npm.
declare module "@virastack/mask" {
  import type { ChangeEvent, FocusEvent, RefCallback } from "react";
  import type { FieldValues, UseFormReturn } from "react-hook-form";

  export interface MaskField {
    name: string;
    ref: RefCallback<HTMLInputElement>;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  }

  export function useViraMask<T extends FieldValues>(form: UseFormReturn<T>, schema: Record<string, unknown>): Record<string, MaskField>;
}
