import { z } from "zod";
import { AssetType, TransactionType } from "@/generated/prisma/enums";

export const portfolio_schema = z.object({
  name: z.string().trim().min(1, "Informe o nome da carteira").max(60, "Nome muito longo"),
});

const trade_date_schema = z.iso
  .date("Data inválida (use AAAA-MM-DD)")
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: "A data não pode estar no futuro",
  });

export const transaction_schema = z.object({
  asset_id: z.string().min(1, "Selecione um ativo"),
  type: z.enum(TransactionType, "Tipo inválido"),
  quantity: z.coerce.number("Quantidade inválida").positive("A quantidade deve ser maior que zero"),
  unit_price: z.coerce.number("Preço inválido").positive("O preço deve ser maior que zero"),
  trade_date: trade_date_schema,
});

export const transaction_update_schema = transaction_schema.partial();

const MAX_CATALOG_LIMIT = 50;

export const catalog_query_schema = z.object({
  type: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(AssetType, "Tipo de ativo inválido"))),
  q: z.string().trim().max(50).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(MAX_CATALOG_LIMIT).optional().default(20),
});

export const simulation_schema = z.object({
  asset_id: z.string().min(1, "Selecione um ativo"),
  amount: z.coerce
    .number("Valor inválido")
    .positive("O valor deve ser maior que zero")
    .max(1_000_000_000, "Valor muito alto"),
  months: z.coerce
    .number("Prazo inválido")
    .int("O prazo deve ser um número inteiro de meses")
    .min(1, "Prazo mínimo de 1 mês")
    .max(600, "Prazo máximo de 600 meses"),
});
