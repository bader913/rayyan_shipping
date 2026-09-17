/**
 * بديل سلطة التفعيل الخاصة بـ Rayyan Pro.
 *
 * في النظام المستقل، الشحن هو النظام بأكمله — لا توجد بوابة ميزة.
 * سكربت الفصل يعيد توجيه استيرادات shippingActivation إلى هنا.
 *
 * إذا احتجت لاحقاً ترخيص SaaS متعدد المستأجرين، استبدل المنطق هنا فقط.
 */
export async function readDeliveryShippingActivationState() {
  return { unlocked: true as const, source: 'standalone' as const };
}

export const DELIVERY_SHIPPING_FEATURE_SETTING_KEY = 'shipping.enabled';
