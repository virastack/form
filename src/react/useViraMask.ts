import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type CompositionEvent,
  type FocusEvent,
  type RefCallback,
} from "react";
import type {
  FieldValues,
  Path,
  PathValue,
  RegisterOptions,
  UseFormRegisterReturn,
  UseFormReturn,
  Validate,
} from "react-hook-form";
import { warn } from "../core/dev";
import { getPath } from "../core/path";
import { resolveSchema, toOutput, type FieldConfig, type MaskSchema, type ResolvedField } from "../core/schema";
import type { InputMode, MaskContext } from "../core/types";
import { isMaskResolver } from "./resolver";

export type ViraMaskRules<T extends FieldValues> = RegisterOptions<T, Path<T>>;

/** One schema entry: a preset name, a preset, or options with `name`, `from`, `rules`, `output`, `onComplete`. */
export type ViraFieldConfig<T extends FieldValues> = FieldConfig<Path<T>, ViraMaskRules<T>>;

/** A key is a form path, or any name when the entry sets `name`. */
export type ViraMaskEntry<T extends FieldValues, K> = K extends Path<T>
  ? ViraFieldConfig<T>
  : ViraFieldConfig<T> & { name: Path<T> };

export type ViraMaskSchema<T extends FieldValues, K extends string = string> = {
  readonly [P in K]: ViraMaskEntry<T, P>;
};

/** Props for an `<input>`. Every key is a valid input attribute; spread it as `{...phone}`. */
export interface MaskField {
  name: string;
  ref: RefCallback<HTMLInputElement>;
  defaultValue: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => void;
  type: "text" | "tel";
  inputMode: InputMode;
  autoComplete?: string;
  disabled?: boolean;
  "aria-invalid"?: true;
}

export type MaskFields<K extends PropertyKey> = { readonly [P in K]: MaskField };

/** Stands in for the DOM element inside React Hook Form, so values cross the boundary unmasked. */
interface FieldProxy {
  readonly name: string;
  readonly type: "text";
  value: unknown;
  readonly readOnly: boolean;
  focus(): void;
  select(): void;
  setCustomValidity(message: string): void;
  reportValidity(): boolean;
}

interface Controller {
  field: ResolvedField;
  el: HTMLInputElement | null;
  /** What the input shows. Kept in sync with the DOM; the value itself lives in React Hook Form. */
  display: string;
  initialDisplay: string;
  complete: boolean;
  registration?: UseFormRegisterReturn;
  proxy: FieldProxy;
  handlers: Pick<MaskField, "ref" | "onChange" | "onBlur" | "onCompositionEnd">;
}

/** The part of `useForm()` the hook uses; independent of resolver context and output types. */
type FormApi<T extends FieldValues> = Pick<
  UseFormReturn<T>,
  "getValues" | "setValue" | "trigger" | "getFieldState" | "formState"
>;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const toText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

/**
 * Masks React Hook Form fields. The form keeps the raw value (`5551234567`); the input shows the mask.
 *
 * @example
 * const form = useForm<{ phone: string; card: string; cvv: string }>();
 * const { phone, card, cvv } = useViraMask(form, {
 *   phone: { preset: "phone", country: "TR" },
 *   card: "card",
 *   cvv: { preset: "cvv", from: "card" },
 * });
 * return <input {...phone} />;
 */
export function useViraMask<
  T extends FieldValues,
  TContext,
  TTransformed,
  const K extends string,
>(form: UseFormReturn<T, TContext, TTransformed>, schema: ViraMaskSchema<T, K>): MaskFields<K> {
  const formRef = useRef(form);
  formRef.current = form;
  const controllersRef = useRef<Map<string, Controller> | null>(null);
  controllersRef.current ??= new Map();
  const controllers = controllersRef.current;

  const getForm = () => formRef.current;
  const ctxOf = (ctrl: Controller): MaskContext => ({
    from: ctrl.field.from ? getForm().getValues(ctrl.field.from as Path<T>) : undefined,
  });

  const fields = resolveSchema(schema as MaskSchema);
  const result: Record<string, MaskField> = {};

  for (const field of fields) {
    let ctrl = controllers.get(field.key);
    if (!ctrl || ctrl.field.name !== field.name) {
      ctrl = createController(field, getForm, ctxOf);
      controllers.set(field.key, ctrl);
    }
    ctrl.field = field;
    ctrl.registration = form.register(field.name as Path<T>, buildRules(ctrl, ctxOf));

    const { error } = form.getFieldState(field.name as Path<T>, form.formState);
    const { disabled } = ctrl.registration;
    result[field.key] = {
      name: field.name,
      defaultValue: ctrl.initialDisplay,
      ...ctrl.handlers,
      ...field.mask.inputProps,
      ...(disabled === undefined ? {} : { disabled }),
      ...(error ? { "aria-invalid": true as const } : {}),
    };
  }

  const activeKeys = fields.map((field) => field.key).join("\u0000");

  useIsomorphicLayoutEffect(() => {
    const active = new Set(activeKeys.split("\u0000"));
    for (const [key, ctrl] of controllers) {
      if (active.has(key)) {
        // React Hook Form talks to the proxy; re-attaching is a no-op unless the field was reset.
        ctrl.registration?.ref(ctrl.proxy);
      } else {
        ctrl.registration?.ref(null);
        controllers.delete(key);
      }
    }
  });

  useEffect(
    () => () => {
      for (const ctrl of controllers.values()) ctrl.registration?.ref(null);
    },
    [controllers],
  );

  const links = fields
    .filter((field) => field.from)
    .map((field) => `${field.key}>${field.from}`)
    .join("|");

  useEffect(() => {
    const linked = [...controllers.values()].filter((ctrl) => ctrl.field.from);
    if (!linked.length) return;
    const sources = [...new Set(linked.map((ctrl) => ctrl.field.from as Path<T>))];

    // Check after every field in this commit has registered (parents mount after children).
    const check = setTimeout(() => {
      for (const ctrl of linked) {
        const from = ctrl.field.from as string;
        if (getPath(getForm().getValues(), from) === undefined) {
          warn(`"${ctrl.field.key}" reads from "${from}", but the form has no field with that name.`);
        }
        if (!ctrl.field.mask.usesFrom) {
          warn(`"${ctrl.field.key}" sets \`from\`, but its mask ("${ctrl.field.mask.name}") doesn't use it.`);
        }
      }
    });

    let active = true;
    const unsubscribe = getForm().subscribe({
      name: sources,
      formState: { values: true },
      callback: ({ name }) => {
        // Wait until React Hook Form has finished dispatching this change. Updating the linked field
        // inside the dispatch would let the rest of the event carry the old values to watch/useWatch.
        queueMicrotask(() => {
          if (!active) return;
          for (const ctrl of controllers.values()) {
            const from = ctrl.field.from;
            if (!from || (name && name !== from && !name.startsWith(`${from}.`))) continue;
            syncLinked(ctrl, getForm(), ctxOf);
          }
        });
      },
    });
    return () => {
      active = false;
      clearTimeout(check);
      unsubscribe();
    };
  }, [links, controllers]);

  useEffect(() => {
    const resolver = getForm().control._options.resolver;
    if (resolver && !isMaskResolver(resolver)) {
      warn(
        "This form uses a resolver, so React Hook Form skips mask validation (e.g. `tckn.invalid`). " +
          "Wrap it with maskResolver(schema, yourResolver) to keep both.",
      );
    }
  }, []);

  return result as MaskFields<K>;
}

function buildRules<T extends FieldValues>(
  ctrl: Controller,
  ctxOf: (ctrl: Controller) => MaskContext,
): ViraMaskRules<T> {
  const rules = (ctrl.field.rules ?? {}) as ViraMaskRules<T>;
  const mask = () => {
    const ctx = ctxOf(ctrl);
    return ctrl.field.mask.validate(ctrl.field.mask.parse(ctrl.display, ctx), ctx) ?? true;
  };
  const validate: Record<string, Validate<PathValue<T, Path<T>>, T>> = { mask };
  if (typeof rules.validate === "function") validate.rule = rules.validate;
  else if (rules.validate) Object.assign(validate, rules.validate);
  return { ...rules, validate };
}

function createController<T extends FieldValues>(
  field: ResolvedField,
  getForm: () => FormApi<T>,
  ctxOf: (ctrl: Controller) => MaskContext,
): Controller {
  const form = getForm();
  const ctrl = {} as Controller;
  ctrl.field = field;
  ctrl.el = null;

  const ctx = ctxOf({ field } as Controller);
  ctrl.display = field.mask.format(form.getValues(field.name as Path<T>), ctx);
  ctrl.initialDisplay = ctrl.display;
  ctrl.complete = field.mask.isComplete(field.mask.parse(ctrl.display, ctx), ctx);

  const readValue = () => {
    const current = ctxOf(ctrl);
    return toOutput(ctrl.field, ctrl.field.mask.parse(ctrl.display, current), current);
  };

  ctrl.proxy = {
    get name() {
      return ctrl.field.name;
    },
    type: "text",
    get value() {
      return readValue();
    },
    set value(next: unknown) {
      const current = ctxOf(ctrl);
      setDisplay(ctrl, ctrl.field.mask.format(next, current));
      ctrl.complete = ctrl.field.mask.isComplete(ctrl.field.mask.parse(ctrl.display, current), current);
    },
    get readOnly() {
      return ctrl.el?.readOnly ?? false;
    },
    focus: () => ctrl.el?.focus(),
    select: () => ctrl.el?.select(),
    setCustomValidity: (message) => ctrl.el?.setCustomValidity(message),
    reportValidity: () => ctrl.el?.reportValidity() ?? true,
  };

  /** Applies the browser's edit through the mask; returns the value when the mask just completed. */
  const applyEdit = (el: HTMLInputElement, inputType: string | undefined, previous = ctrl.display) => {
    const current = ctxOf(ctrl);
    const next = ctrl.field.mask.edit(
      { previous, value: el.value, selectionStart: el.selectionStart, inputType },
      current,
    );
    setDisplay(ctrl, next.display, next.cursor);
    const justCompleted = next.complete && !ctrl.complete;
    ctrl.complete = next.complete;
    return justCompleted ? toOutput(ctrl.field, next.value, current) : undefined;
  };

  const commit = (completed: string | undefined) => {
    void ctrl.registration?.onChange({ target: ctrl.proxy, type: "change" });
    if (completed !== undefined) ctrl.field.onComplete?.(completed);
  };

  ctrl.handlers = {
    ref(el: HTMLInputElement | null) {
      ctrl.el = el;
      // No cleanup return: React 18 warns about it, and both versions pass `null` on detach.
      if (!el || el.value === ctrl.display) return;
      if (el.value === ctrl.initialDisplay || el.value === "") {
        // Remounted with a stale default: show the current value.
        setDisplay(ctrl, ctrl.display);
      } else {
        // Typed before hydration finished: take the text as input.
        commit(applyEdit(el, undefined, ""));
      }
    },
    onChange(event) {
      const native = event.nativeEvent as Partial<InputEvent>;
      // Let IME composition finish; compositionend formats the result.
      if (native.isComposing) return;
      commit(applyEdit(event.currentTarget, native.inputType));
    },
    onCompositionEnd(event) {
      commit(applyEdit(event.currentTarget, undefined));
    },
    onBlur() {
      const current = ctxOf(ctrl);
      const value = ctrl.field.mask.parse(ctrl.display, current);
      const finalized = ctrl.field.mask.finalize(value, current);
      if (finalized !== value) setDisplay(ctrl, ctrl.field.mask.format(finalized, current));
      void ctrl.registration?.onBlur({ target: ctrl.proxy, type: "blur" });
    },
  };

  return ctrl;
}

function setDisplay(ctrl: Controller, display: string, cursor?: number) {
  ctrl.display = display;
  const { el } = ctrl;
  if (!el) return;
  if (el.value !== display) el.value = display;
  if (cursor !== undefined && el.ownerDocument.activeElement === el) el.setSelectionRange(cursor, cursor);
}

/** Re-applies a mask when the field it reads `from` changes (Amex → Visa trims the CVV to 3 digits). */
function syncLinked<T extends FieldValues>(
  ctrl: Controller,
  typed: FormApi<T>,
  ctxOf: (ctrl: Controller) => MaskContext,
) {
  const name = ctrl.field.name as Path<T>;
  const ctx = ctxOf(ctrl);
  const stored = toText(typed.getValues(name));
  const raw = ctrl.field.mask.parse(stored, ctx);
  setDisplay(ctrl, ctrl.field.mask.format(raw, ctx));
  ctrl.complete = ctrl.field.mask.isComplete(raw, ctx);
  if (stored === "") return;

  const { error } = typed.getFieldState(name);
  const revalidate = typed.formState.isSubmitted || Boolean(error);
  const next = toOutput(ctrl.field, raw, ctx);
  if (next !== stored) {
    typed.setValue(name, next as PathValue<T, Path<T>>, { shouldDirty: true, shouldValidate: revalidate });
  } else if (revalidate) {
    void typed.trigger(name);
  }
}
