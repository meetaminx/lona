/** Headline amount with superscript cents, e.g. 2,023<sup>.12</sup>. Input is a formatted "1,234.56". */
export function Amount({ value, currency, prefix, className }: { value: string; currency?: string; prefix?: string; className?: string }) {
  const [whole, cents] = value.split(".");
  return (
    <span className={`amount-sup ${className ?? ""}`}>
      {prefix}
      {whole}
      {cents !== undefined && <sup>.{cents}</sup>}
      {currency && <span className="amount-cur">{currency}</span>}
    </span>
  );
}
