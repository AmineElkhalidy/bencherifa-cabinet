import { PRESCRIPTION_BRAND_COLORS } from "./brand-colors";
import { APP_CONFIG } from "../config";

/** Static header/footer content matching the physical ordonnance stationery. */
export const PRESCRIPTION_CABINET = {
  doctorNameFr: APP_CONFIG.doctorNameFr,
  doctorNameAr: APP_CONFIG.doctorNameAr,
  specialtyFr: APP_CONFIG.specialtyFr,
  specialtyAr: APP_CONFIG.specialtyAr,
  credentialsFr: APP_CONFIG.credentialsFr,
  credentialsAr: APP_CONFIG.credentialsAr,
  title: APP_CONFIG.title,
  location: APP_CONFIG.location,
  phones: APP_CONFIG.phones,
  addressFr: APP_CONFIG.addressFr,
  addressAr: APP_CONFIG.addressAr,
  /** Accent green used on stationery (rules, specialty, hand in logo) */
  accentGreen: PRESCRIPTION_BRAND_COLORS.green,
  heartRed: PRESCRIPTION_BRAND_COLORS.heart,
} as const;
