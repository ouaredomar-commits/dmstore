import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert, Clock } from 'lucide-react';
import { PublicPhoneCheckResult } from '../types';
import { normalizeAndValidateAlgerianPhone } from '../utils/orderSecurity';

interface PhoneOrderAlertBannerProps {
  phone: string;
  items?: {
    productId: string;
    variantId?: string;
    quantity: number;
  }[];
}

export const PhoneOrderAlertBanner: React.FC<PhoneOrderAlertBannerProps> = ({ phone, items }) => {
  const [checkResult, setCheckResult] = useState<PublicPhoneCheckResult | null>(null);

  const itemsKey = (items || [])
    .map((i) => `${i.productId}:${i.variantId || ''}:${i.quantity}`)
    .join('|');

  useEffect(() => {
    const trimmed = String(phone || '').trim();
    if (!trimmed) {
      setCheckResult(null);
      return;
    }

    const phoneValidation = normalizeAndValidateAlgerianPhone(trimmed);
    if (!phoneValidation.isValid || !phoneValidation.normalized) {
      setCheckResult(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/orders/check-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: trimmed,
            items: items || [],
          }),
        });
        if (!res.ok) return;
        const data: PublicPhoneCheckResult = await res.json();
        if (!cancelled) {
          setCheckResult(data);
        }
      } catch {
        // Non-blocking: ignore network errors during live phone check
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phone, itemsKey]);

  if (
    !checkResult ||
    !checkResult.isValidPhone ||
    (!checkResult.hasPreviousOrders &&
      !checkResult.hasCancelledOrders &&
      !checkResult.hasRecentActiveOrder)
  ) {
    return null;
  }

  return (
    <div className="mt-2.5 space-y-2" role="status" aria-live="polite">
      {/* B. Commande déjà annulée (Alerte plus visible) */}
      {checkResult.hasCancelledOrders && checkResult.alerts.cancelledAlert && (
        <div className="p-3 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold leading-snug">{checkResult.alerts.cancelledAlert}</p>
            <p className="text-[11px] text-rose-700">
              Cette alerte est informative et ne bloque pas votre commande. Un opérateur pourra vous contacter par téléphone avant expédition.
            </p>
          </div>
        </div>
      )}

      {/* C. Commande identique ou récente en cours */}
      {checkResult.hasRecentActiveOrder && checkResult.alerts.recentOrderAlert && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-[#FF6500] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold leading-snug">{checkResult.alerts.recentOrderAlert}</p>
            {checkResult.alerts.recentOrderSubtext && (
              <p className="text-[11px] text-amber-800">{checkResult.alerts.recentOrderSubtext}</p>
            )}
          </div>
        </div>
      )}

      {/* A. Numéro déjà utilisé (Alerte non bloquante) */}
      {checkResult.hasPreviousOrders && checkResult.alerts.usedBeforeAlert && (
        <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-200 text-[#002244] text-xs flex items-start gap-2">
          {checkResult.hasCancelledOrders ? (
            <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <p className="font-semibold leading-snug">{checkResult.alerts.usedBeforeAlert}</p>
            {checkResult.alerts.usedBeforeSubtext && (
              <p className="text-[11px] text-slate-600">{checkResult.alerts.usedBeforeSubtext}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
