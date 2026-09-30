import { require_session } from "@/lib/auth/session";
import { AppError, not_found_error } from "@/lib/errors";
import { json_ok, with_error_handling } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { get_quote, to_quote_dto } from "@/services/market/market_data_service";

type Context = RouteContext<"/api/quotes/[asset_id]">;

/** Current quote of an asset, served from the 30-minute database cache. */
export const GET = with_error_handling<Context>(async (_request, context) => {
  await require_session();
  const { asset_id } = await context.params;
  const asset = await prisma.asset.findUnique({ where: { id: asset_id } });
  if (!asset) {
    throw not_found_error("Ativo não encontrado");
  }
  const quote = await get_quote(asset);
  if (!quote) {
    throw new AppError(422, "QUOTE_UNAVAILABLE", `Cotação de ${asset.code} indisponível no momento`);
  }
  return json_ok(to_quote_dto(quote));
});
