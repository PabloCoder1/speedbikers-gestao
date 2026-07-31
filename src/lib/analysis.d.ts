// Tipos para o núcleo de análise (implementado em analysis.js)
export function analyze(vendasRaw: any, estoqueRaw: any, opts: any): any;
export function readSheetSmart(wb: any, wanted: any): any[];
export function mlRowsToVendas(rows: any[]): any[];
export const brl: (n: number) => string;
export const brlc: (n: number) => string;
export const dstr: (d: Date | null) => string;
