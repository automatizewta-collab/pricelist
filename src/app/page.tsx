"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  Loader2,
  Package,
  AlertCircle,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import {
  SHEETS_MAPPING,
  formatCurrency,
  type MarketKey,
  type PrecosMap,
} from "@/config/sheets-mapping";

interface Produto {
  id: number;
  codigo: string;
  nome: string;
  categoria: string | null;
  hasImagem: boolean;
  imagemUrl: string | null;
  precos: PrecosMap;
  ativo: number;
  updatedAt: string;
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [total, setTotal] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  // Force refresh de imagens após upload
  const [imageRefreshKey, setImageRefreshKey] = useState(0);

  // Carrega o role do usuário
  useEffect(() => {
    async function fetchRole() {
      try {
        const response = await fetch("/api/me");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin === true);
        }
      } catch {
        setIsAdmin(false);
      }
    }
    fetchRole();
  }, []);

  const fetchProdutos = useCallback(
    async (searchTerm?: string, cat?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm) params.set("search", searchTerm);
        if (cat && cat !== "all") params.set("categoria", cat);

        const response = await fetch(`/api/produtos?${params.toString()}`);
        if (!response.ok) throw new Error("Erro ao buscar produtos");

        const data = await response.json();
        setProdutos(data.produtos || []);
        setCategorias(data.categorias || []);
        setTotal(data.total || 0);
      } catch {
        toast.error("Erro ao buscar produtos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  const handleSearch = useCallback(() => {
    setHasSearched(true);
    fetchProdutos(search, categoria);
  }, [search, categoria, fetchProdutos]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/sync/sheets", { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 403) {
          toast.error("Acesso negado. Somente administradores podem sincronizar.");
        } else {
          throw new Error(data.error || "Erro na sincronização");
        }
        return;
      }
      const data = await response.json();
      toast.success(
        `Sincronização concluída! ${data.imported} novos, ${data.updated} atualizados.`
      );
      fetchProdutos(search, categoria);
    } catch {
      toast.error("Erro ao sincronizar com a planilha.");
    } finally {
      setSyncing(false);
    }
  }, [search, categoria, fetchProdutos]);

  const handleImageUploaded = useCallback(
    (codigo: string) => {
      // Força o navegador a recarregar a imagem (bypass cache)
      setImageRefreshKey((prev) => prev + 1);
      fetchProdutos(search, categoria);
      toast.success("Imagem atualizada com sucesso!");
    },
    [search, categoria, fetchProdutos]
  );

  const marketEntries = Object.entries(SHEETS_MAPPING.precos) as [
    MarketKey,
    (typeof SHEETS_MAPPING.precos)[MarketKey]
  ][];

  return (
    <div className="min-h-screen flex flex-col bg-wta-gray">
      {/* Header */}
      <header className="bg-white border-b-4 border-wta-red shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <img
                src="/wta-logo.png"
                alt="Logo WTA"
                className="h-14 sm:h-16 w-auto object-contain"
              />
            </div>

            {/* Título */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-wta-black">
                Consulta de Preços
              </h1>
              <p className="text-base sm:text-lg text-wta-gray-dark">
                Tabela de preços atualizada para vendedores
              </p>
            </div>

            {/* Role indicator + Sync Button */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Badge de role */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                isAdmin
                  ? "bg-wta-red/10 text-wta-red border border-wta-red/30"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}>
                {isAdmin ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Consulta
                  </>
                )}
              </div>

              {/* Sync — só para admin */}
              {isAdmin && (
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-12 px-6 text-base gap-2 bg-wta-red hover:bg-wta-red-dark text-white"
                >
                  {syncing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                  Sincronizar Planilha
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Barra de busca */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <Input
                type="text"
                placeholder="Buscar por código ou nome do produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-14 text-lg border-2 border-gray-300 focus:border-wta-red focus:ring-wta-red/20"
              />
              <Button
                onClick={handleSearch}
                className="h-14 px-8 text-lg gap-2 bg-wta-red hover:bg-wta-red-dark text-white shrink-0"
              >
                <Search className="h-5 w-5" />
                Buscar
              </Button>
            </div>

            {/* Filtro de categoria */}
            <Select
              value={categoria || "all"}
              onValueChange={(val) => {
                const v = val === "all" ? "" : val;
                setCategoria(v);
                fetchProdutos(search, v);
              }}
            >
              <SelectTrigger className="h-14 w-full sm:w-64 text-lg border-2 border-gray-300">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent className="text-lg">
                <SelectItem value="all" className="text-lg">
                  Todas categorias
                </SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-lg">
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contagem de resultados */}
          <div className="mt-2 text-base text-wta-gray-dark">
            {loading ? (
              "Buscando..."
            ) : (
              <>
                <span className="font-semibold text-wta-black">{total}</span>{" "}
                produto{total !== 1 ? "s" : ""} encontrado
                {total !== 1 ? "s" : ""}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-wta-red" />
            <p className="text-xl text-wta-gray-dark">Carregando produtos...</p>
          </div>
        )}

        {/* Empty state - no results */}
        {!loading && hasSearched && produtos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="h-16 w-16 text-wta-gray-dark" />
            <p className="text-xl text-wta-gray-dark">
              Nenhum produto encontrado para &quot;{search}&quot;
            </p>
            <Button
              variant="outline"
              className="h-12 text-lg"
              onClick={() => {
                setSearch("");
                setCategoria("");
                setHasSearched(false);
                fetchProdutos();
              }}
            >
              Limpar busca
            </Button>
          </div>
        )}

        {/* Empty state - no data */}
        {!loading && !hasSearched && produtos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Package className="h-16 w-16 text-wta-gray-dark" />
            <p className="text-xl text-wta-gray-dark">
              Nenhum produto cadastrado ainda.
            </p>
            {isAdmin && (
              <p className="text-lg text-wta-gray-dark">
                Clique em &quot;Sincronizar Planilha&quot; para importar os dados.
              </p>
            )}
          </div>
        )}

        {/* Grid de produtos */}
        {!loading && produtos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {produtos.map((produto) => (
              <Card
                key={produto.id}
                className="overflow-hidden hover:shadow-lg transition-shadow border-2 border-transparent hover:border-wta-red/20"
              >
                {/* Imagem do produto — carrega direto do arquivo estático */}
                <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {produto.hasImagem && produto.imagemUrl ? (
                    <img
                      src={`${produto.imagemUrl}?v=${imageRefreshKey}`}
                      alt={produto.nome}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-wta-gray-dark">
                      <Package className="h-16 w-16" />
                      <span className="text-sm">Sem imagem</span>
                    </div>
                  )}
                </div>

                <CardHeader className="pb-2 px-4 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-wta-red">
                        {produto.codigo}
                      </p>
                      <h3 className="text-lg font-semibold text-wta-black leading-tight line-clamp-2">
                        {produto.nome}
                      </h3>
                    </div>
                    {produto.categoria && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 text-sm bg-wta-gray text-wta-gray-dark"
                      >
                        {produto.categoria}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-2">
                  {/* Badges de preço */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {marketEntries.map(([key, config]) => {
                      const price = produto.precos[key];
                      if (!price) return null;
                      return (
                        <Badge
                          key={key}
                          className="text-base px-3 py-1.5 bg-white border-2 border-gray-200 text-wta-black gap-1.5 font-medium"
                        >
                          <span>{config.bandeira}</span>
                          <span>{formatCurrency(price.valor, price.moeda)}</span>
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Sem preços */}
                  {Object.keys(produto.precos).length === 0 && (
                    <p className="text-base text-wta-gray-dark italic mt-2">
                      Sem preços cadastrados
                    </p>
                  )}

                  {/* Botão Alterar Foto — só para admin */}
                  {isAdmin && (
                    <div className="mt-3">
                      <ImageUploader
                        codigo={produto.codigo}
                        nome={produto.nome}
                        onUploadSuccess={() => handleImageUploaded(produto.codigo)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-wta-black text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-base">
            © {new Date().getFullYear()} WTA — Consulta de Preços v1.2
          </p>
        </div>
      </footer>
    </div>
  );
}
