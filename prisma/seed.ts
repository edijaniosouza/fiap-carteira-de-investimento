/**
 * Manual seed: `npm run seed` (or `npx prisma db seed`).
 * 1. B3 assets from brapi.dev (/quote/list) — falls back to a small sample when offline.
 * 2. Treasury bonds from prisma/data/treasury_prices.csv (Tesouro Transparente) — falls back to samples.
 * 3. Market indexes (CDI, SELIC, IPCA) with current rates from BCB SGS.
 * 4. Sample CDBs.
 * Idempotent: every asset is upserted by `code`.
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { AssetSource, AssetType, Indexer } from "../src/generated/prisma/enums";
import { BCB_SERIES, fetch_bcb_index_rate, type BcbIndexCode } from "../src/services/market/bcb_client";
import { fetch_brapi_list_page, type BrapiListedAsset } from "../src/services/market/brapi_client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const BRAPI_PAGE_SIZE = 100;
const BRAPI_MAX_PAGES = 100;
const UPSERT_CONCURRENCY = 5;
const TREASURY_CSV_PATH = path.join(process.cwd(), "prisma", "data", "treasury_prices.csv");

/** brapi lists ETFs as "fund"; known ETF tickers are classified explicitly. */
const KNOWN_ETFS = new Set([
  "BOVA11", "BOVV11", "BOVX11", "BRAX11", "DIVO11", "ECOO11", "FIND11", "GOLD11", "HASH11",
  "IVVB11", "MATB11", "NASD11", "PIBB11", "SMAL11", "SPXI11", "XBOV11", "XINA11", "EURP11",
  "ACWI11", "BBSD11", "B5P211", "IMAB11", "IRFM11", "FIXA11", "QBTC11", "ETHE11", "BITH11",
  "WRLD11", "SMAC11", "TECK11", "NFTS11", "META11", "DEFI11", "USTK11",
]);

const SAMPLE_B3_ASSETS: BrapiListedAsset[] = [
  { ticker: "PETR4", name: "Petrobras PN", brapi_type: "stock", sector: null, close_price: null },
  { ticker: "VALE3", name: "Vale ON", brapi_type: "stock", sector: null, close_price: null },
  { ticker: "ITUB4", name: "Itaú Unibanco PN", brapi_type: "stock", sector: null, close_price: null },
  { ticker: "BBAS3", name: "Banco do Brasil ON", brapi_type: "stock", sector: null, close_price: null },
  { ticker: "MGLU3", name: "Magazine Luiza ON", brapi_type: "stock", sector: null, close_price: null },
  { ticker: "WEGE3", name: "WEG ON", brapi_type: "stock", sector: null, close_price: null },
  { ticker: "HGLG11", name: "CSHG Logística FII", brapi_type: "fund", sector: null, close_price: null },
  { ticker: "MXRF11", name: "Maxi Renda FII", brapi_type: "fund", sector: null, close_price: null },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária FII", brapi_type: "fund", sector: null, close_price: null },
  { ticker: "BOVA11", name: "iShares Ibovespa ETF", brapi_type: "fund", sector: null, close_price: null },
  { ticker: "IVVB11", name: "iShares S&P 500 ETF", brapi_type: "fund", sector: null, close_price: null },
  { ticker: "AAPL34", name: "Apple BDR", brapi_type: "bdr", sector: null, close_price: null },
];

type SeedAsset = {
  code: string;
  name: string;
  type: AssetType;
  source: AssetSource;
  indexer?: Indexer | null;
  rate?: number | null;
  maturity_date?: Date | null;
  quote?: { value: number; source: AssetSource; updated_at: Date } | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

function upsert_asset(asset: SeedAsset) {
  const data = {
    name: asset.name,
    type: asset.type,
    source: asset.source,
    indexer: asset.indexer ?? null,
    rate: asset.rate ?? null,
    maturity_date: asset.maturity_date ?? null,
  };
  return prisma.asset.upsert({
    where: { code: asset.code },
    create: {
      code: asset.code,
      ...data,
      ...(asset.quote ? { quote: { create: asset.quote } } : {}),
    },
    update: {
      ...data,
      ...(asset.quote ? { quote: { upsert: { create: asset.quote, update: asset.quote } } } : {}),
    },
  });
}

async function upsert_assets(assets: SeedAsset[]): Promise<void> {
  for (const batch of chunk(assets, UPSERT_CONCURRENCY)) {
    await Promise.all(batch.map(upsert_asset));
  }
}

// ---------- 1. B3 assets (brapi) ----------

function to_b3_asset_type(listed: BrapiListedAsset): AssetType {
  if (KNOWN_ETFS.has(listed.ticker)) return "ETF";
  if (listed.brapi_type === "bdr") return "BDR";
  if (listed.brapi_type === "fund") return "FII";
  return "STOCK";
}

async function fetch_b3_assets(): Promise<BrapiListedAsset[]> {
  const listed: BrapiListedAsset[] = [];
  try {
    for (let page = 1; page <= BRAPI_MAX_PAGES; page++) {
      const result = await fetch_brapi_list_page(page, BRAPI_PAGE_SIZE);
      listed.push(...result.assets);
      if (!result.has_next_page) break;
    }
    return listed;
  } catch (error) {
    console.warn(`[seed] brapi list unavailable (${(error as Error).message}); using sample assets`);
    return listed.length > 0 ? listed : SAMPLE_B3_ASSETS;
  }
}

/** Odd-lot tickers (e.g. PETR4F) duplicate the standard lot and are not listed. */
const FRACTIONAL_TICKER_PATTERN = /^[A-Z0-9]{4}\d{1,2}F$/;

async function remove_fractional_assets(): Promise<void> {
  const candidates = await prisma.asset.findMany({
    where: { source: "BRAPI", code: { endsWith: "F" }, transactions: { none: {} } },
    select: { id: true, code: true },
  });
  const ids = candidates.filter((asset) => FRACTIONAL_TICKER_PATTERN.test(asset.code)).map((asset) => asset.id);
  if (ids.length > 0) {
    await prisma.asset.deleteMany({ where: { id: { in: ids } } });
  }
}

async function seed_b3_assets(): Promise<number> {
  const listed = await fetch_b3_assets();
  const now = new Date();
  const unique_assets = new Map<string, SeedAsset>();
  for (const item of listed) {
    if (FRACTIONAL_TICKER_PATTERN.test(item.ticker)) continue;
    unique_assets.set(item.ticker, {
      code: item.ticker,
      name: item.name,
      type: to_b3_asset_type(item),
      source: "BRAPI",
      quote:
        item.close_price != null && item.close_price > 0
          ? { value: item.close_price, source: "BRAPI", updated_at: now }
          : null,
    });
  }
  await upsert_assets([...unique_assets.values()]);
  await remove_fractional_assets();
  return unique_assets.size;
}

// ---------- 2. Treasury bonds (CSV) ----------

type TreasuryRow = {
  title: string;
  maturity_date: Date;
  base_date: Date;
  buy_rate: number;
  unit_price: number;
};

function parse_br_date(value: string): Date {
  const [day, month, year] = value.trim().split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function parse_br_number(value: string): number {
  return Number(value.trim().replace(/\./g, "").replace(",", "."));
}

function treasury_indexer(title: string): Indexer | null {
  if (/selic/i.test(title)) return "SELIC";
  if (/ipca|educa|renda\+/i.test(title)) return "IPCA";
  if (/prefixado/i.test(title)) return "PRE";
  return null; // IGP-M bonds are not supported
}

function treasury_slug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^tesouro\s+/i, "")
    .replace(/com juros semestrais/i, "JS")
    .replace(/aposentadoria extra/i, "")
    .replace(/\+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function read_treasury_csv(): TreasuryRow[] {
  const content = readFileSync(TREASURY_CSV_PATH, "latin1");
  const [header_line, ...lines] = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = header_line.split(";").map((header) => header.trim().toLowerCase());
  const column = (name: string) => headers.indexOf(name);
  const indexes = {
    title: column("tipo titulo"),
    maturity: column("data vencimento"),
    base: column("data base"),
    buy_rate: column("taxa compra manha"),
    buy_price: column("pu compra manha"),
    base_price: column("pu base manha"),
  };
  if (Object.values(indexes).some((index) => index < 0)) {
    throw new Error(`unexpected CSV header: ${header_line}`);
  }

  return lines.map((line) => {
    const cells = line.split(";");
    const buy_price = parse_br_number(cells[indexes.buy_price]);
    return {
      title: cells[indexes.title].trim(),
      maturity_date: parse_br_date(cells[indexes.maturity]),
      base_date: parse_br_date(cells[indexes.base]),
      buy_rate: parse_br_number(cells[indexes.buy_rate]),
      unit_price: buy_price > 0 ? buy_price : parse_br_number(cells[indexes.base_price]),
    };
  });
}

function latest_treasury_rows(rows: TreasuryRow[]): TreasuryRow[] {
  const today = new Date();
  const latest = new Map<string, TreasuryRow>();
  for (const row of rows) {
    if (row.maturity_date < today || !treasury_indexer(row.title)) continue;
    const key = `${row.title}|${row.maturity_date.toISOString()}`;
    const current = latest.get(key);
    if (!current || row.base_date > current.base_date) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
}

function sample_treasury_assets(): SeedAsset[] {
  const year = new Date().getUTCFullYear();
  return [
    { title: "Tesouro Selic", years: 3, rate: 100 },
    { title: "Tesouro Prefixado", years: 4, rate: 13 },
    { title: "Tesouro IPCA+", years: 10, rate: 7 },
  ].map((sample) => ({
    code: `TD_${treasury_slug(sample.title)}_${year + sample.years}`,
    name: `${sample.title} ${year + sample.years}`,
    type: "TREASURY",
    source: "SEED",
    indexer: treasury_indexer(sample.title),
    rate: sample.rate,
    maturity_date: new Date(Date.UTC(year + sample.years, 0, 1)),
  }));
}

async function seed_treasury_assets(): Promise<number> {
  if (!existsSync(TREASURY_CSV_PATH)) {
    console.warn(`[seed] ${TREASURY_CSV_PATH} not found; using sample treasury bonds (see README)`);
    const samples = sample_treasury_assets();
    await upsert_assets(samples);
    return samples.length;
  }

  const used_codes = new Set<string>();
  const assets = latest_treasury_rows(read_treasury_csv()).map((row): SeedAsset => {
    const indexer = treasury_indexer(row.title);
    const year = row.maturity_date.getUTCFullYear();
    let code = `TD_${treasury_slug(row.title)}_${year}`;
    if (used_codes.has(code)) {
      code = `${code}${String(row.maturity_date.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    used_codes.add(code);
    return {
      code,
      name: `${row.title} ${year}`,
      type: "TREASURY",
      source: "SEED",
      indexer,
      // Tesouro Selic pays Selic + a tiny spread: modeled as 100% of Selic.
      rate: indexer === "SELIC" ? 100 : row.buy_rate,
      maturity_date: row.maturity_date,
      quote:
        row.unit_price > 0
          ? { value: row.unit_price, source: "SEED", updated_at: row.base_date }
          : null,
    };
  });
  await upsert_assets(assets);
  return assets.length;
}

// ---------- 3. Market indexes (BCB) ----------

const INDEX_NAMES: Record<BcbIndexCode, string> = {
  CDI: "CDI (taxa anualizada)",
  SELIC: "Taxa Selic (meta)",
  IPCA: "IPCA (acumulado 12 meses)",
};

async function seed_indexes(): Promise<number> {
  const codes = Object.keys(BCB_SERIES) as BcbIndexCode[];
  const assets: SeedAsset[] = [];
  for (const code of codes) {
    let quote: SeedAsset["quote"] = null;
    try {
      quote = { value: await fetch_bcb_index_rate(code), source: "BCB", updated_at: new Date() };
    } catch (error) {
      console.warn(`[seed] BCB rate for ${code} unavailable (${(error as Error).message})`);
    }
    assets.push({
      code,
      name: INDEX_NAMES[code],
      type: "INDEX",
      source: "BCB",
      indexer: code,
      quote,
    });
  }
  await upsert_assets(assets);
  return assets.length;
}

// ---------- 4. Sample CDBs ----------

const SAMPLE_CDBS: SeedAsset[] = [
  { code: "CDB_100_CDI", name: "CDB 100% CDI", type: "CDB", source: "SEED", indexer: "CDI", rate: 100 },
  { code: "CDB_110_CDI", name: "CDB 110% CDI", type: "CDB", source: "SEED", indexer: "CDI", rate: 110 },
  { code: "CDB_PRE_12", name: "CDB Prefixado 12% a.a.", type: "CDB", source: "SEED", indexer: "PRE", rate: 12 },
  { code: "CDB_IPCA_6", name: "CDB IPCA + 6% a.a.", type: "CDB", source: "SEED", indexer: "IPCA", rate: 6 },
];

async function main(): Promise<void> {
  console.info("[seed] starting");
  console.info(`[seed] B3 assets: ${await seed_b3_assets()}`);
  console.info(`[seed] treasury bonds: ${await seed_treasury_assets()}`);
  console.info(`[seed] indexes: ${await seed_indexes()}`);
  await upsert_assets(SAMPLE_CDBS);
  console.info(`[seed] CDBs: ${SAMPLE_CDBS.length}`);
  console.info(`[seed] done — ${await prisma.asset.count()} assets in catalog`);
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
