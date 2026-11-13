import { useEffect, useState, type ReactNode } from 'react';
import type { Cents, IsoDate } from '../db/types';
import { centsToInput, parseEuro } from '../domain/money';

interface BaseProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
}

function Wrap({ label, hint, error, className, children }: BaseProps & { children: ReactNode }) {
  return (
    <label className={`field ${error ? 'invalid' : ''} ${className ?? ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="error">{error}</small> : hint ? <small className="hint">{hint}</small> : null}
    </label>
  );
}

export function TextField(
  props: BaseProps & {
    value: string | undefined;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: 'text' | 'email' | 'url' | 'tel';
    autoFocus?: boolean;
    inputMode?: 'text' | 'numeric' | 'decimal';
  },
) {
  return (
    <Wrap {...props}>
      <input
        type={props.type ?? 'text'}
        value={props.value ?? ''}
        placeholder={props.placeholder}
        autoFocus={props.autoFocus}
        inputMode={props.inputMode}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Wrap>
  );
}

export function TextArea(
  props: BaseProps & { value: string | undefined; onChange: (v: string) => void; placeholder?: string; rows?: number },
) {
  return (
    <Wrap {...props}>
      <textarea
        value={props.value ?? ''}
        rows={props.rows}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Wrap>
  );
}

export function DateField(
  props: BaseProps & { value: IsoDate | undefined; onChange: (v: IsoDate | undefined) => void; min?: IsoDate },
) {
  return (
    <Wrap {...props}>
      <input
        type="date"
        value={props.value ?? ''}
        min={props.min}
        onChange={(e) => props.onChange(e.target.value || undefined)}
      />
    </Wrap>
  );
}

/** Euro-Eingabe; speichert Cent. Wird beim Verlassen des Feldes formatiert. */
export function MoneyField(
  props: BaseProps & { value: Cents | undefined; onChange: (v: Cents | undefined) => void; placeholder?: string },
) {
  const { value, onChange } = props;
  const [text, setText] = useState(centsToInput(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(centsToInput(value));
  }, [value, focused]);

  const invalid = text.trim() !== '' && parseEuro(text) === undefined;

  return (
    <Wrap {...props} error={props.error ?? (invalid ? 'Ungültiger Betrag' : undefined)}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          placeholder={props.placeholder ?? '0,00'}
          style={{ paddingRight: 32 }}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setText(e.target.value);
            const cents = parseEuro(e.target.value);
            if (e.target.value.trim() === '') onChange(undefined);
            else if (cents !== undefined) onChange(cents);
          }}
          onBlur={() => {
            setFocused(false);
            setText(centsToInput(parseEuro(text)));
          }}
        />
        <span
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
          className="muted"
        >
          €
        </span>
      </div>
    </Wrap>
  );
}

export function NumberField(
  props: BaseProps & { value: number | undefined; onChange: (v: number | undefined) => void; suffix?: string; step?: number },
) {
  return (
    <Wrap {...props}>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          inputMode="decimal"
          step={props.step ?? 1}
          value={props.value ?? ''}
          onChange={(e) => props.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          style={props.suffix ? { paddingRight: 44 } : undefined}
        />
        {props.suffix && (
          <span
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
            className="muted"
          >
            {props.suffix}
          </span>
        )}
      </div>
    </Wrap>
  );
}

export function SelectField<T extends string>(
  props: BaseProps & { value: T | undefined; onChange: (v: T | undefined) => void; options: { value: T; label: string }[]; empty?: string },
) {
  return (
    <Wrap {...props}>
      <select value={props.value ?? ''} onChange={(e) => props.onChange((e.target.value || undefined) as T | undefined)}>
        {props.empty !== undefined && <option value="">{props.empty}</option>}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  className,
  children,
}: {
  label?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <label className={`check ${className ?? ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label ?? children}</span>
    </label>
  );
}
