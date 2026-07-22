export const APP_CONFIG = {
  clinicName: process.env.NEXT_PUBLIC_CLINIC_NAME || "Medical Demo Clinic",
  doctorNameFr: process.env.NEXT_PUBLIC_DOCTOR_NAME_FR || "Dr. John Doe",
  doctorNameAr: process.env.NEXT_PUBLIC_DOCTOR_NAME_AR || "الدكتور : فلان الفلاني",
  specialtyFr: process.env.NEXT_PUBLIC_SPECIALTY_FR || "Médecin généraliste",
  specialtyAr: process.env.NEXT_PUBLIC_SPECIALTY_AR || "طبيب عام",
  credentialsFr: process.env.NEXT_PUBLIC_CREDENTIALS_FR || "Lauréat de la faculté de médecine",
  credentialsAr: process.env.NEXT_PUBLIC_CREDENTIALS_AR || "خريج كلية الطب",
  title: process.env.NEXT_PUBLIC_TITLE || "Ordonnance Médicale",
  location: process.env.NEXT_PUBLIC_LOCATION || "CITY NAME",
  phones: process.env.NEXT_PUBLIC_PHONES 
    ? process.env.NEXT_PUBLIC_PHONES.split(",") 
    : ["06 00 00 00 00", "05 00 00 00 00"],
  addressFr: process.env.NEXT_PUBLIC_ADDRESS_FR || "123 Demo Street, Suite 4",
  addressAr: process.env.NEXT_PUBLIC_ADDRESS_AR || "123 شارع تجريبي، شقة 4",
} as const;
