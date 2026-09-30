import "server-only";
import type { z } from "zod";
import type { Asset, Prisma, Transaction } from "@/generated/prisma/client";
import { AppError, not_found_error } from "@/lib/errors";
import { format_date } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type {
  transaction_schema,
  transaction_update_schema,
} from "@/lib/validators/portfolio_validators";
import { get_investable_asset, to_asset_summary_dto } from "@/services/catalog_service";
import { get_owned_portfolio } from "@/services/portfolio_service";
import { find_negative_balance, type TimelineEntry } from "@/services/timeline_validation";
import type { TransactionDto } from "@/types/api";

type TransactionInput = z.infer<typeof transaction_schema>;
type TransactionUpdateInput = z.infer<typeof transaction_update_schema>;
type TransactionClient = Prisma.TransactionClient;

const PENDING_ENTRY_ID = "__pending__";

function to_transaction_dto(transaction: Transaction & { asset: Asset }): TransactionDto {
  const quantity = Number(transaction.quantity);
  const unit_price = Number(transaction.unit_price);
  return {
    id: transaction.id,
    portfolio_id: transaction.portfolio_id,
    asset: to_asset_summary_dto(transaction.asset),
    type: transaction.type,
    quantity,
    unit_price,
    total: Math.round(quantity * unit_price * 100) / 100,
    trade_date: transaction.trade_date.toISOString().slice(0, 10),
    created_at: transaction.created_at.toISOString(),
  };
}

function to_timeline_entry(transaction: Transaction): TimelineEntry {
  return {
    id: transaction.id,
    type: transaction.type,
    quantity: Number(transaction.quantity),
    trade_date: transaction.trade_date,
    created_at: transaction.created_at,
  };
}

function parse_trade_date(iso_date: string): Date {
  return new Date(`${iso_date}T00:00:00.000Z`);
}

/** Serializes concurrent writes on the same portfolio. */
async function lock_portfolio(tx: TransactionClient, portfolio_id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM portfolios WHERE id = ${portfolio_id} FOR UPDATE`;
}

/**
 * Validates that the quantity of an asset never becomes negative along the
 * timeline after applying a change (`replace_entry` replaces or adds an entry,
 * `remove_entry_id` removes one).
 */
async function assert_valid_timeline(
  tx: TransactionClient,
  params: {
    portfolio_id: string;
    asset: Asset;
    replace_entry?: TimelineEntry;
    remove_entry_id?: string;
  },
): Promise<void> {
  const existing = await tx.transaction.findMany({
    where: { portfolio_id: params.portfolio_id, asset_id: params.asset.id },
  });
  const entries = existing
    .filter((transaction) => transaction.id !== params.remove_entry_id)
    .filter((transaction) => transaction.id !== params.replace_entry?.id)
    .map(to_timeline_entry);
  if (params.replace_entry) {
    entries.push(params.replace_entry);
  }

  const violation = find_negative_balance(entries);
  if (violation) {
    const trade_date = violation.trade_date.toISOString().slice(0, 10);
    throw new AppError(
      422,
      "NEGATIVE_BALANCE",
      `Operação deixaria a quantidade de ${params.asset.code} negativa em ${format_date(trade_date)}`,
      { asset_code: params.asset.code, trade_date, balance: violation.balance },
    );
  }
}

async function get_owned_transaction(portfolio_id: string, transaction_id: string): Promise<Transaction> {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transaction_id, portfolio_id },
  });
  if (!transaction) {
    throw not_found_error("Transação não encontrada");
  }
  return transaction;
}

export async function list_transactions(user_id: string, portfolio_id: string): Promise<TransactionDto[]> {
  await get_owned_portfolio(user_id, portfolio_id);
  const transactions = await prisma.transaction.findMany({
    where: { portfolio_id },
    include: { asset: true },
    orderBy: [{ trade_date: "desc" }, { created_at: "desc" }],
  });
  return transactions.map(to_transaction_dto);
}

export async function create_transaction(
  user_id: string,
  portfolio_id: string,
  input: TransactionInput,
): Promise<TransactionDto> {
  await get_owned_portfolio(user_id, portfolio_id);
  const asset = await get_investable_asset(input.asset_id);
  const trade_date = parse_trade_date(input.trade_date);

  const created = await prisma.$transaction(async (tx) => {
    await lock_portfolio(tx, portfolio_id);
    await assert_valid_timeline(tx, {
      portfolio_id,
      asset,
      replace_entry: {
        id: PENDING_ENTRY_ID,
        type: input.type,
        quantity: input.quantity,
        trade_date,
        created_at: new Date(),
      },
    });
    return tx.transaction.create({
      data: {
        portfolio_id,
        asset_id: asset.id,
        type: input.type,
        quantity: input.quantity,
        unit_price: input.unit_price,
        trade_date,
      },
      include: { asset: true },
    });
  });
  return to_transaction_dto(created);
}

export async function update_transaction(
  user_id: string,
  portfolio_id: string,
  transaction_id: string,
  input: TransactionUpdateInput,
): Promise<TransactionDto> {
  await get_owned_portfolio(user_id, portfolio_id);
  const current = await get_owned_transaction(portfolio_id, transaction_id);
  const next_asset_id = input.asset_id ?? current.asset_id;
  const next_asset = await get_investable_asset(next_asset_id);
  const next_entry: TimelineEntry = {
    id: current.id,
    type: input.type ?? current.type,
    quantity: input.quantity ?? Number(current.quantity),
    trade_date: input.trade_date ? parse_trade_date(input.trade_date) : current.trade_date,
    created_at: current.created_at,
  };

  const updated = await prisma.$transaction(async (tx) => {
    await lock_portfolio(tx, portfolio_id);
    await assert_valid_timeline(tx, { portfolio_id, asset: next_asset, replace_entry: next_entry });
    if (next_asset_id !== current.asset_id) {
      // Moving the transaction to another asset must keep the old asset's timeline valid too.
      const previous_asset = await tx.asset.findUniqueOrThrow({ where: { id: current.asset_id } });
      await assert_valid_timeline(tx, {
        portfolio_id,
        asset: previous_asset,
        remove_entry_id: current.id,
      });
    }
    return tx.transaction.update({
      where: { id: current.id },
      data: {
        asset_id: next_asset_id,
        type: next_entry.type,
        quantity: next_entry.quantity,
        unit_price: input.unit_price ?? undefined,
        trade_date: next_entry.trade_date,
      },
      include: { asset: true },
    });
  });
  return to_transaction_dto(updated);
}

export async function delete_transaction(
  user_id: string,
  portfolio_id: string,
  transaction_id: string,
): Promise<void> {
  await get_owned_portfolio(user_id, portfolio_id);
  const current = await get_owned_transaction(portfolio_id, transaction_id);

  await prisma.$transaction(async (tx) => {
    await lock_portfolio(tx, portfolio_id);
    const asset = await tx.asset.findUniqueOrThrow({ where: { id: current.asset_id } });
    await assert_valid_timeline(tx, { portfolio_id, asset, remove_entry_id: current.id });
    await tx.transaction.delete({ where: { id: current.id } });
  });
}
