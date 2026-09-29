// ===========================================================================
// FILA OFFLINE das rondas (IndexedDB). Sem rede, a leitura da tag e o
// checklist ficam aqui e são enviados quando a conexão volta. O servidor
// valida tudo igual e marca "sincronizado tarde": o horário oficial é o do
// servidor no envio; o relógio do tablet vai só como informação.
// ===========================================================================
export interface ItemFila {
  id: string;
  url: string | null;
  serial_number: string | null;
  capturado_em: string;
  checklist: Record<string, Record<string, string | string[]>>;
  quarto: string | null;
  usuario_id: string;
}

const BANCO = "blue-rondas";
const LOJA = "fila";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comLoja<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(LOJA, modo);
    const req = fn(tx.objectStore(LOJA));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function enfileirar(item: ItemFila): Promise<IDBValidKey> {
  return comLoja("readwrite", (s) => s.put(item));
}

export async function itensDaFila(): Promise<ItemFila[]> {
  const itens = await comLoja<ItemFila[]>("readonly", (s) => s.getAll() as IDBRequest<ItemFila[]>);
  // Ordem de captura: o contador da tag precisa chegar em ordem crescente.
  return itens.sort((a, b) => a.capturado_em.localeCompare(b.capturado_em));
}

export function removerDaFila(id: string): Promise<undefined> {
  return comLoja("readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
}
