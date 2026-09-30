import "server-only";
import type { z } from "zod";
import type { Asset, Quote } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, not_found_error } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { catalog_query_schema } from "@/lib/validators/portfolio_validators";
import type { AssetDto, AssetSummaryDto, PaginatedResponse } from "@/types/api";

export function to_asset_summary_dto(asset: Asset): AssetSummaryDto {
  return {
    id: asset.id,
    code: asset.code,
    name: asset.name,
    type: asset.type,
    indexer: asset.indexer,
    rate: asset.rate == null ? null : Number(asset.rate),
  };
}

export function to_asset_dto(asset: Asset & { quote: Quote | null }): AssetDto {
  return {
    ...to_asset_summary_dto(asset),
    source: asset.source,
    maturity_date: asset.maturity_date?.toISOString().slice(0, 10) ?? null,
    last_price: asset.quote ? Number(asset.quote.value) : null,
    last_price_updated_at: asset.quote?.updated_at.toISOString() ?? null,
  };
}

export async function search_assets(
  query: z.infer<typeof catalog_query_schema>,
): Promise<PaginatedResponse<AssetDto>> {
  const where: Prisma.AssetWhereInput = {
    // Market indexes (CDI, SELIC, IPCA) are reference data, not investable assets.
    type: query.type.length > 0 ? { in: query.type } : { not: "INDEX" },
    ...(query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, assets] = await prisma.$transaction([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      include: { quote: true },
      orderBy: { code: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: assets.map(to_asset_dto),
    page: query.page,
    limit: query.limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

/** Loads an asset that can be bought/sold or simulated (indexes are excluded). */
export async function get_investable_asset(asset_id: string): Promise<Asset> {
  const asset = await prisma.asset.findUnique({ where: { id: asset_id } });
  if (!asset) {
    throw not_found_error("Ativo não encontrado");
  }
  if (asset.type === "INDEX") {
    throw new AppError(400, "BAD_REQUEST", "Índices de referência não podem ser negociados");
  }
  return asset;
}
