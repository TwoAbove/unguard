interface JobForHold {
  pricingMode: "flat" | "hourly";
  agreedFlatAmountCents: number | null;
  agreedRateCents: number | null;
  estimatedDurationMinutes: number | null;
}

interface HoldEstimateInput {
  pricingMode: "flat" | "hourly";
  agreedFlatAmountCents?: number;
  agreedRateCents?: number;
  estimatedDurationMinutes?: number;
}

export const readHoldEstimate = (job: JobForHold): HoldEstimateInput | undefined => {
  if (job.pricingMode === "flat") {
    if (job.agreedFlatAmountCents === null) {
      return undefined;
    }

    return {
      agreedFlatAmountCents: job.agreedFlatAmountCents,
      pricingMode: "flat",
    };
  }

  if (job.agreedRateCents === null || job.estimatedDurationMinutes === null) {
    return undefined;
  }

  return {
    agreedRateCents: job.agreedRateCents,
    estimatedDurationMinutes: job.estimatedDurationMinutes,
    pricingMode: "hourly",
  };
};
