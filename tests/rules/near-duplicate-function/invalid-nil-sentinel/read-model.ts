interface JobHoldTermsInput {
  pricingMode: "flat" | "hourly";
  agreedFlatAmountCents: number | null;
  agreedRateCents: number | null;
  estimatedDurationMinutes: number | null;
}

interface HoldEstimate {
  pricingMode: "flat" | "hourly";
  agreedFlatAmountCents?: number;
  agreedRateCents?: number;
  estimatedDurationMinutes?: number;
}

export const readJobHoldEstimate = (input: JobHoldTermsInput): HoldEstimate | null => { // @expect near-duplicate-function
  if (input.pricingMode === "flat") {
    if (input.agreedFlatAmountCents === null) {
      return null;
    }
    return {
      agreedFlatAmountCents: input.agreedFlatAmountCents,
      pricingMode: "flat",
    };
  }

  if (
    input.agreedRateCents === null ||
    input.estimatedDurationMinutes === null
  ) {
    return null;
  }
  return {
    agreedRateCents: input.agreedRateCents,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    pricingMode: "hourly",
  };
};
