import React from 'react';
import { formatNumber } from '@/lib/utils-binaa';

// The official Saudi Riyal symbol (background removed).
export const RIYAL_SYMBOL_URL =
  'https://media.base44.com/images/public/6a44ed8818188b4da27cc800/0eacd2653_generated_image.png';

/**
 * Money — renders an amount with the Saudi Riyal symbol image beside it.
 * Use everywhere amounts are displayed on screen.
 *
 * Props:
 * - value: the numeric amount
 * - decimals: fraction digits (default 2)
 * - className: extra classes for the wrapper
 * - size: symbol height in px (default 14)
 */
export default function Money({ value, decimals = 2, className = '', size = 14 }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`} dir="ltr">
      <span>{formatNumber(value, decimals)}</span>
      <img
        src={RIYAL_SYMBOL_URL}
        alt="ر.س"
        style={{ height: size, width: 'auto' }}
        className="inline-block object-contain"
      />
    </span>
  );
}