import type { ServiceTemplate } from '../core/types';

/** Large aesthetic / dental catalog — prices in SYP-like scale (matches legacy seed magnitude). */
export function buildServiceTemplates(): ServiceTemplate[] {
  return [
    { name: 'جلسة ليزر كامل الجسم', category: 'laser', priceSyp: 450000, durationMinutes: 90, aliases: ['ليزر', 'جسم'], aiKeywords: ['ليزر جسم', 'full body'], popularity: 0.72, discountable: true, packageEligible: true },
    { name: 'ليزر مناطق محددة', category: 'laser', priceSyp: 180000, durationMinutes: 45, aliases: ['ليزر', 'شعر'], aiKeywords: ['إزالة شعر', 'مناطق'], popularity: 0.88, discountable: true, packageEligible: true },
    { name: 'جلسة IPL للوجه', category: 'laser', priceSyp: 140000, durationMinutes: 40, aliases: ['IPL'], aiKeywords: ['IPL وجه'], popularity: 0.62, discountable: true, packageEligible: true },
    { name: 'إزالة وشم بالليزر', category: 'laser', priceSyp: 165000, durationMinutes: 35, aliases: ['وشم'], aiKeywords: ['tattoo'], popularity: 0.35, discountable: false, packageEligible: false },
    { name: 'هيدرافيشال', category: 'hydrafacial', priceSyp: 175000, durationMinutes: 55, aliases: ['هيدرا'], aiKeywords: ['هيدرافيشال', 'ترطيب'], popularity: 0.78, discountable: true, packageEligible: true },
    { name: 'تنظيف بشرة عميق', category: 'skincare', priceSyp: 95000, durationMinutes: 45, aliases: ['فيشال'], aiKeywords: ['تنظيف بشرة'], popularity: 0.9, discountable: true, packageEligible: true },
    { name: 'تقشير كيميائي خفيف', category: 'skincare', priceSyp: 125000, durationMinutes: 30, aliases: ['تقشير'], aiKeywords: ['PCA', 'peel'], popularity: 0.55, discountable: true, packageEligible: true },
    { name: 'ميزوثيرابي للوجه', category: 'skincare', priceSyp: 220000, durationMinutes: 40, aliases: ['ميزو'], aiKeywords: ['ميزوثيرابي'], popularity: 0.58, discountable: true, packageEligible: true },
    { name: 'جلسة كولاجين تحفيزي', category: 'skincare', priceSyp: 195000, durationMinutes: 50, aliases: ['كولاجين'], aiKeywords: ['collagen'], popularity: 0.48, discountable: true, packageEligible: true },
    { name: 'بوتوكس تجميلي', category: 'injectables', priceSyp: 320000, durationMinutes: 25, aliases: ['بوتوكس'], aiKeywords: ['بوتكس', 'حقن بوتكس', 'تجاعيد'], popularity: 0.92, discountable: false, packageEligible: false },
    { name: 'فيلر شفاه', category: 'fillers', priceSyp: 380000, durationMinutes: 35, aliases: ['فيلر'], aiKeywords: ['نفخ شفاه', 'شفاه'], popularity: 0.85, discountable: false, packageEligible: false },
    { name: 'فيلر خدود', category: 'fillers', priceSyp: 420000, durationMinutes: 40, aliases: ['خدود'], aiKeywords: ['نفخ خدود'], popularity: 0.68, discountable: false, packageEligible: false },
    { name: 'حقن هيالورونيك تحت العين', category: 'fillers', priceSyp: 260000, durationMinutes: 30, aliases: ['هالات'], aiKeywords: ['هيالورونيك'], popularity: 0.52, discountable: false, packageEligible: false },
    { name: 'بلازما PRP للوجه', category: 'prp', priceSyp: 290000, durationMinutes: 50, aliases: ['PRP'], aiKeywords: ['بلازما', 'صفائح'], popularity: 0.44, discountable: true, packageEligible: true },
    { name: 'PRP للشعر', category: 'hair', priceSyp: 310000, durationMinutes: 55, aliases: ['شعر'], aiKeywords: ['PRP شعر', 'تساقط'], popularity: 0.5, discountable: true, packageEligible: true },
    { name: 'خيوط PDO رفع خفيف', category: 'surgery_consult', priceSyp: 450000, durationMinutes: 45, aliases: ['PDO'], aiKeywords: ['خيوط'], popularity: 0.28, discountable: false, packageEligible: false },
    { name: 'استشارة تجميل غير جراحي', category: 'surgery_consult', priceSyp: 75000, durationMinutes: 30, aliases: ['استشارة'], aiKeywords: ['استشارة تجميل'], popularity: 0.65, discountable: true, packageEligible: false },
    { name: 'تبييض أسنان زوم', category: 'whitening', priceSyp: 280000, durationMinutes: 50, aliases: ['زوم'], aiKeywords: ['تبييض أسنان'], popularity: 0.74, discountable: true, packageEligible: true },
    { name: 'تنظيف أسنان احترافي', category: 'dental', priceSyp: 85000, durationMinutes: 45, aliases: ['جير'], aiKeywords: ['تنظيف أسنان'], popularity: 0.82, discountable: true, packageEligible: true },
    { name: 'حشو تجميلي أمامي', category: 'dental', priceSyp: 195000, durationMinutes: 40, aliases: ['حشو'], aiKeywords: ['ابتسامة'], popularity: 0.7, discountable: true, packageEligible: false },
    { name: 'فينير خزف سن واحد', category: 'veneers', priceSyp: 420000, durationMinutes: 60, aliases: ['فينير'], aiKeywords: ['قشرة أسنان'], popularity: 0.33, discountable: false, packageEligible: false },
    { name: 'استشارة ابتسامة هوليوود', category: 'dental', priceSyp: 75000, durationMinutes: 30, aliases: ['ابتسامة'], aiKeywords: ['هوليوود'], popularity: 0.41, discountable: true, packageEligible: false },
    { name: 'حقن مادة تجديدية لليدين', category: 'injectables', priceSyp: 240000, durationMinutes: 35, aliases: ['يدين'], aiKeywords: ['يدين'], popularity: 0.22, discountable: true, packageEligible: false },
    { name: 'مزيج علاجي حب شباب نشط', category: 'skincare', priceSyp: 155000, durationMinutes: 45, aliases: ['حب شباب'], aiKeywords: ['acne'], popularity: 0.6, discountable: true, packageEligible: true },
    { name: 'جلسة ما بعد ليزر (تهدئة)', category: 'skincare', priceSyp: 65000, durationMinutes: 25, aliases: ['تهدئة'], aiKeywords: ['after laser'], popularity: 0.45, discountable: true, packageEligible: true },
    { name: 'باقة 3 هيدرافيشال', category: 'packages', priceSyp: 465000, durationMinutes: 60, aliases: ['باقة'], aiKeywords: ['package hydra'], popularity: 0.36, discountable: true, packageEligible: false },
    { name: 'موعد قصير — متابعة', category: 'general', priceSyp: 25000, durationMinutes: 15, aliases: ['متابعة'], aiKeywords: ['follow'], popularity: 0.95, discountable: false, packageEligible: false },
  ];
}

/** Booking phrases for AI metadata — DomainEvent / audit friendly */
export const BOOKING_PHRASES_AR = [
  'بدي موعد بوتوكس بكرا الظهر',
  'فيكن تحجزولي هيدرافيشال مع دكتورة الجلدية؟',
  'بدي ليزر مناطق للعريس بعد أسبوعين',
  'موعد فينير ضروري قبل السفر',
  'بدي استشارة فيلر بدون نفخ كثير',
  'في موعد طوارئ لحرق بسيط بعد ليزر؟',
];
