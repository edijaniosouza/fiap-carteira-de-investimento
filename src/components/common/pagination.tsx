import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  total_pages: number;
  total: number;
  on_page_change: (page: number) => void;
};

export function Pagination({ page, total_pages, total, on_page_change }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {total.toLocaleString("pt-BR")} resultado(s) · página {page} de {total_pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => on_page_change(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon /> Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= total_pages}
          onClick={() => on_page_change(page + 1)}
          aria-label="Próxima página"
        >
          Próxima <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
