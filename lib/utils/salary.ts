export function formatSalary(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSalaryRange(min: number | null, max: number | null): string {
  if (!min && !max) return "A convenir";
  if (min && !max) return `Desde ${formatSalary(min)}`;
  if (!min && max) return `Hasta ${formatSalary(max)}`;
  return `${formatSalary(min!)} - ${formatSalary(max!)}`;
}
