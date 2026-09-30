import { z } from "zod";

const REQUEST_TIMEOUT_MS = 8_000;

/** SGS series codes (Banco Central). Values are annual percentages. */
export const BCB_SERIES = {
  CDI: 4389, // CDI anualizado base 252
  SELIC: 432, // Meta Selic definida pelo Copom
  IPCA: 13522, // IPCA acumulado 12 meses
} as const;

export type BcbIndexCode = keyof typeof BCB_SERIES;

const series_response_schema = z
  .array(z.object({ data: z.string(), valor: z.string() }))
  .min(1);

export async function fetch_bcb_index_rate(index_code: BcbIndexCode): Promise<number> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${BCB_SERIES[index_code]}/dados/ultimos/1?formato=json`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`BCB SGS request failed with status ${response.status}`);
  }
  const payload = series_response_schema.parse(await response.json());
  const value = Number(payload[payload.length - 1].valor.replace(",", "."));
  if (!Number.isFinite(value)) {
    throw new Error(`BCB SGS returned an invalid value for ${index_code}`);
  }
  return value;
}

export function is_bcb_index_code(code: string): code is BcbIndexCode {
  return code in BCB_SERIES;
}
