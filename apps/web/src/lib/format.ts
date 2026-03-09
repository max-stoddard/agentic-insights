export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(value));
}

export function formatLitres(value: number): string {
  if (value === 0) {
    return "0 L";
  }

  if (Math.abs(value) < 1) {
    return `${(value * 1000).toFixed(1)} mL`;
  }

  if (Math.abs(value) < 100) {
    return `${value.toFixed(2)} L`;
  }

  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1
  }).format(value)} L`;
}

export function formatDateTime(value: number | null): string {
  if (!value) {
    return "Not indexed yet";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
