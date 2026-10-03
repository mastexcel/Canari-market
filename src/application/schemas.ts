/**
 * Schémas de validation (zod) partagés : API, formulaires web et futures
 * applications mobiles valident les mêmes règles. Le serveur revalide TOUJOURS.
 */
import { z } from "zod";

export const COMMUNES = [
  "Abobo",
  "Adjamé",
  "Attécoubé",
  "Bingerville",
  "Cocody",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Port-Bouët",
  "Songon",
  "Treichville",
  "Yopougon",
  "Anyama",
] as const;

const phone = z.string().trim().min(8, "Numéro requis").max(20);
const password = z
  .string()
  .min(8, "8 caractères minimum")
  .max(128)
  .regex(/[A-Za-z]/, "Au moins une lettre")
  .regex(/\d/, "Au moins un chiffre");

export const signupSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(50),
  lastName: z.string().trim().max(50).optional().or(z.literal("")),
  phone,
  password,
  accountType: z.enum(["HOUSEHOLD", "MERCHANT"]).default("HOUSEHOLD"),
  businessName: z.string().trim().max(80).optional(),
  commune: z.enum(COMMUNES, { errorMap: () => ({ message: "Choisissez votre commune" }) }),
  quartier: z.string().trim().min(2, "Quartier requis").max(80),
  adults: z.coerce.number().int().min(1).max(20).default(2),
  children: z.coerce.number().int().min(0).max(20).default(0),
  referralCode: z.string().trim().max(20).optional().or(z.literal("")),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions" }) }),
  marketingSms: z.boolean().default(false),
  marketingWhatsapp: z.boolean().default(false),
  /** Champ piège anti-robot (invisible) : doit rester vide. */
  website: z.string().max(0, "Inscription refusée.").optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({ phone, password: z.string().min(1, "Mot de passe requis").max(128) });

export const cartItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("GROUP_BUY"), portionId: z.string().min(1), quantity: z.number().int().min(1).max(50) }),
  z.object({ kind: z.literal("STOCK"), variantId: z.string().min(1), quantity: z.number().int().min(1).max(50) }),
]);

export const cartUpdateSchema = z.object({ quantity: z.number().int().min(0).max(50) });

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default("Domicile"),
  commune: z.enum(COMMUNES),
  quartier: z.string().trim().min(2).max(80),
  landmark: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(20).optional(),
});

export const checkoutSchema = z
  .object({
    fulfillmentMode: z.enum(["PICKUP", "HOME_DELIVERY"]),
    pickupPointId: z.string().optional(),
    addressId: z.string().optional(),
    newAddress: addressSchema.optional(),
    deliverySpeed: z.enum(["STANDARD", "SCHEDULED"]).default("STANDARD"),
    slotStart: z.string().datetime().optional(),
    slotEnd: z.string().datetime().optional(),
    promoCode: z.string().trim().max(30).optional().or(z.literal("")),
    useCredit: z.boolean().default(false),
    creditConsent: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillmentMode === "PICKUP" && !v.pickupPointId) {
      ctx.addIssue({ code: "custom", path: ["pickupPointId"], message: "Choisissez un point relais" });
    }
    if (v.fulfillmentMode === "HOME_DELIVERY" && !v.addressId && !v.newAddress) {
      ctx.addIssue({ code: "custom", path: ["addressId"], message: "Indiquez une adresse de livraison" });
    }
    if (v.deliverySpeed === "SCHEDULED" && (!v.slotStart || !v.slotEnd)) {
      ctx.addIssue({ code: "custom", path: ["slotStart"], message: "Choisissez un créneau" });
    }
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const paymentInitSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["MOBILE_MONEY", "CARD"]),
  operator: z.enum(["ORANGE_MONEY", "MTN_MOMO", "MOOV_MONEY", "WAVE"]).optional(),
  payerPhone: z.string().trim().max(20).optional(),
  purpose: z.enum(["ORDER", "SUPPLEMENT"]).default("ORDER"),
  orderItemId: z.string().optional(),
});

export const communitySchema = z.object({
  name: z.string().trim().min(4, "Nom trop court").max(60),
  type: z.enum(["NEIGHBORHOOD", "RESIDENCE", "COMPANY", "ASSOCIATION", "OTHER"]),
  commune: z.enum(COMMUNES),
  quartier: z.string().trim().max(80).optional(),
  description: z.string().trim().max(400).optional(),
  pickupPointId: z.string().optional(),
  deliveryWeekday: z.coerce.number().int().min(0).max(6).optional(),
  isPublic: z.boolean().default(true),
});

const tierSchema = z.object({ minUnits: z.number().int().positive(), unitPrice: z.number().int().positive() });

export const groupBuySchema = z.object({
  title: z.string().trim().min(4).max(80),
  description: z.string().trim().min(10).max(1000),
  productId: z.string().min(1),
  supplierProductId: z.string().optional(),
  communityId: z.string().optional(),
  supplierUnitLabel: z.string().trim().min(2).max(40),
  supplierUnitQuantityBase: z.number().int().positive(),
  targetUnits: z.number().int().positive(),
  maxUnits: z.number().int().positive(),
  referenceUnitPrice: z.number().int().positive(),
  referenceSource: z.string().trim().min(3).max(120),
  referenceMethod: z.string().trim().min(3).max(160),
  referenceObservedAt: z.coerce.date(),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  expectedDeliveryAt: z.coerce.date(),
  failurePolicy: z.enum(["EXTEND", "REFUND", "ALTERNATIVE_PRICE", "CREDIT_WITH_CONSENT"]),
  extensionDays: z.number().int().min(1).max(14).default(3),
  maxExtensions: z.number().int().min(0).max(3).default(1),
  alternativeUnitPrice: z.number().int().positive().optional(),
  supplierUnitCost: z.number().int().positive(),
  inboundTransportPerUnit: z.number().int().min(0).default(0),
  storagePerUnit: z.number().int().min(0).default(0),
  fractionationFeePerPortion: z.number().int().min(0).default(0),
  fractionationCostPerPortion: z.number().int().min(0).default(0),
  packagingCostPerPortion: z.number().int().min(0).default(0),
  lossRateBps: z.number().int().min(0).max(2000).default(100),
  paymentFeeBps: z.number().int().min(0).max(1000).default(150),
  deliveryCostPerOrder: z.number().int().min(0).default(0),
  promotionCostPerUnit: z.number().int().min(0).default(0),
  expectedAvgPortionBase: z.number().int().positive(),
  tiers: z.array(tierSchema).min(1).max(8),
  portions: z.array(z.object({ label: z.string().trim().min(1).max(30), quantityBase: z.number().int().positive() })).min(1).max(8),
});
export type GroupBuyInput = z.infer<typeof groupBuySchema>;

export const rfqResponseSchema = z.object({
  unitPrice: z.number().int().positive(),
  unitsOffered: z.number().int().positive(),
  leadTimeDays: z.number().int().min(0).max(120),
  conditions: z.string().trim().max(500).optional(),
  deliveryLocation: z.string().trim().min(3).max(160),
  qualityNote: z.string().trim().max(300).optional(),
  validUntil: z.coerce.date(),
});

export const supportTicketSchema = z.object({
  category: z.enum(["ORDER", "PAYMENT", "DELIVERY", "PRODUCT", "ACCOUNT", "OTHER"]),
  subject: z.string().trim().min(4).max(120),
  message: z.string().trim().min(10).max(2000),
  orderId: z.string().optional(),
});

export const reviewSchema = z.object({
  orderId: z.string().min(1),
  target: z.enum(["ORDER", "PRODUCT", "DELIVERY"]),
  productId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
