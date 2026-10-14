import { prisma } from "@/lib/db";
import { ageOn, parseBirthDate } from "@/lib/age-gate";
import { RESEARCH_MIN_AGE, cleanCountries, cleanEthnicities, cleanSex, parseList } from "@/lib/demographics/options";

export class DemographicsError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DemographicsError";
    this.status = status;
  }
}

export type DemographicsDTO = {
  sex: "male" | "female" | null;
  ethnicities: string[];
  originCountries: string[];
  researchConsent: boolean;
  consentAt: string | null;
  ageConfirmed: boolean;
};

export async function getDemographics(userId: string): Promise<DemographicsDTO> {
  const d = await prisma.userDemographics.findUnique({ where: { userId } });
  return {
    sex: cleanSex(d?.sex),
    ethnicities: cleanEthnicities(parseList(d?.ethnicities)),
    originCountries: cleanCountries(parseList(d?.originCountries)),
    researchConsent: Boolean(d?.researchConsent),
    consentAt: d?.consentAt?.toISOString() ?? null,
    ageConfirmed: Boolean(d?.age16ConfirmedAt),
  };
}

/** Pure: is this date of birth 16+ today? (DOB is never stored.) */
export function isAtLeast16(birthDate: unknown, today = new Date()): boolean | null {
  const b = parseBirthDate(birthDate);
  if (!b) return null;
  const age = ageOn(b, today);
  if (age < 0 || age > 120) return null;
  return age >= RESEARCH_MIN_AGE;
}

/**
 * Save the user's own optional demographics. Turning research consent on needs
 * a date of birth showing 16+ (checked, not stored) unless already confirmed.
 * Turning it off (opt-out) clears consent and the age confirmation.
 */
export async function saveDemographics(
  userId: string,
  input: { sex?: unknown; ethnicities?: unknown; originCountries?: unknown; researchConsent?: unknown; birthDate?: unknown },
  now = new Date()
): Promise<DemographicsDTO> {
  const existing = await prisma.userDemographics.findUnique({ where: { userId } });
  const consent = input.researchConsent === true;
  let age16ConfirmedAt = existing?.age16ConfirmedAt ?? null;
  let consentAt = existing?.researchConsent ? existing.consentAt : null;
  if (consent) {
    if (!age16ConfirmedAt) {
      const ok = isAtLeast16(input.birthDate, now);
      if (ok === null) throw new DemographicsError("Enter your date of birth to confirm you're 16 or older.");
      if (!ok) throw new DemographicsError("Research sharing is only for people 16 or older. Your other choices were not changed.");
      age16ConfirmedAt = now;
    }
    consentAt = consentAt ?? now;
  } else {
    consentAt = null;
    age16ConfirmedAt = null;
  }
  const data = {
    sex: cleanSex(input.sex),
    ethnicities: JSON.stringify(cleanEthnicities(input.ethnicities)),
    originCountries: JSON.stringify(cleanCountries(input.originCountries)),
    researchConsent: consent,
    consentAt,
    age16ConfirmedAt,
  };
  await prisma.userDemographics.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return getDemographics(userId);
}
