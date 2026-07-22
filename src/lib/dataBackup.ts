import * as XLSX from 'xlsx-js-style'
import { supabase } from './supabase'

/**
 * Backup completo da plataforma (somente administradores).
 *
 * Coleta todas as linhas de todas as tabelas do schema public e gera:
 *  - Um workbook Excel (.xlsx) estilizado, uma aba por tabela + índice.
 *  - Um dump SQL (.sql) apenas de dados, em ordem segura de FKs para restauração.
 */

/**
 * Tabelas na ordem em que devem ser inseridas para respeitar as chaves
 * estrangeiras (pais antes dos filhos). Usada tanto no Excel quanto no SQL.
 */
export const BACKUP_TABLES = [
    'business_units',
    'pillars',
    'teams',
    'users',
    'team_business_units',
    'team_members',
    'user_business_units',
    'objectives',
    'key_results',
    'kr_monthly_data',
    'kr_attachments',
    'action_plans',
    'action_plan_tasks',
    'action_plan_task_completions',
    'action_plan_comments',
    'action_plan_attachments',
    'audit_logs',
] as const

/** Colunas que são arrays nativos do Postgres (não jsonb). */
const PG_ARRAY_COLUMNS: Record<string, 'int' | 'text'> = {
    'action_plan_tasks.recurrence_weekdays': 'int',
    'key_results.owner_names': 'text',
}

export type TableData = Record<string, unknown>[]
export type BackupData = Record<string, TableData>

export interface BackupProgress {
    /** Tabela sendo coletada no momento. */
    table: string
    /** Índice (base 1) da tabela atual. */
    current: number
    /** Total de tabelas. */
    total: number
}

/**
 * Busca todas as linhas de uma tabela, paginando de 1000 em 1000 (limite
 * padrão do Supabase). Ordena por `created_at` para paginação estável e
 * deduplica por `id` quando a coluna existe.
 */
async function fetchAllRows(table: string): Promise<TableData> {
    const pageSize = 1000
    const rows: TableData = []
    let from = 0

    for (; ;) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1)

        if (error) throw new Error(`Falha ao ler "${table}": ${error.message}`)
        if (!data || data.length === 0) break

        rows.push(...(data as TableData))
        if (data.length < pageSize) break
        from += pageSize
    }

    // Deduplica por id caso timestamps repetidos tenham cruzado o limite da página.
    if (rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], 'id')) {
        const seen = new Set<unknown>()
        return rows.filter((r) => {
            if (seen.has(r.id)) return false
            seen.add(r.id)
            return true
        })
    }

    return rows
}

/** Coleta todos os dados de todas as tabelas do backup. */
export async function fetchBackupData(
    onProgress?: (p: BackupProgress) => void,
): Promise<BackupData> {
    const result: BackupData = {}
    const total = BACKUP_TABLES.length

    for (let i = 0; i < total; i++) {
        const table = BACKUP_TABLES[i]
        onProgress?.({ table, current: i + 1, total })
        result[table] = await fetchAllRows(table)
    }

    return result
}

/** Data no formato YYYY-MM-DD para nome de arquivo. */
function fileDateStamp(): string {
    return new Date().toISOString().slice(0, 10)
}

/** União ordenada das chaves de todas as linhas (mantém a ordem de descoberta). */
function unionColumns(rows: TableData): string[] {
    const cols: string[] = []
    const seen = new Set<string>()
    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!seen.has(key)) {
                seen.add(key)
                cols.push(key)
            }
        }
    }
    return cols
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

function escapeSqlString(value: string): string {
    return value.replace(/'/g, "''")
}

/** Formata um valor JS como literal SQL de acordo com o tipo da coluna. */
function toSqlLiteral(table: string, column: string, value: unknown): string {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'

    if (Array.isArray(value)) {
        const arrType = PG_ARRAY_COLUMNS[`${table}.${column}`]
        if (arrType === 'int') {
            return value.length
                ? `ARRAY[${value.map((n) => Number(n)).join(',')}]::int4[]`
                : `ARRAY[]::int4[]`
        }
        if (arrType === 'text') {
            return value.length
                ? `ARRAY[${value.map((s) => `'${escapeSqlString(String(s))}'`).join(',')}]::text[]`
                : `ARRAY[]::text[]`
        }
        // Array JSON (jsonb)
        return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`
    }

    if (typeof value === 'object') {
        return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`
    }

    return `'${escapeSqlString(String(value))}'`
}

/** Gera o conteúdo do dump SQL (apenas dados). */
export function buildSqlDump(data: BackupData): string {
    const lines: string[] = []
    const generatedAt = new Date().toISOString()

    lines.push('-- =============================================================')
    lines.push('-- OKR Dashboard — Backup completo de dados')
    lines.push(`-- Gerado em: ${generatedAt}`)
    lines.push(`-- Tabelas: ${BACKUP_TABLES.length}`)
    lines.push('-- Dump apenas de dados (INSERT). Restaure em um schema compatível.')
    lines.push('-- As tabelas estão em ordem segura de chaves estrangeiras.')
    lines.push('-- =============================================================')
    lines.push('')
    lines.push('BEGIN;')
    lines.push('')

    const batchSize = 500

    for (const table of BACKUP_TABLES) {
        const rows = data[table] ?? []
        lines.push('-- ' + '-'.repeat(57))
        lines.push(`-- ${table} (${rows.length} ${rows.length === 1 ? 'registro' : 'registros'})`)
        lines.push('-- ' + '-'.repeat(57))

        if (rows.length === 0) {
            lines.push(`-- (sem registros)`)
            lines.push('')
            continue
        }

        const columns = unionColumns(rows)
        const columnList = columns.map((c) => `"${c}"`).join(', ')

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize)
            lines.push(`INSERT INTO public."${table}" (${columnList}) VALUES`)
            const valueLines = batch.map((row, idx) => {
                const values = columns
                    .map((col) => toSqlLiteral(table, col, row[col]))
                    .join(', ')
                const terminator = idx === batch.length - 1 ? ';' : ','
                return `  (${values})${terminator}`
            })
            lines.push(...valueLines)
            lines.push('')
        }
    }

    lines.push('COMMIT;')
    lines.push('')

    return lines.join('\n')
}

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/** Gera e baixa o dump SQL a partir dos dados coletados. */
export function downloadSqlBackup(data: BackupData): void {
    const sql = buildSqlDump(data)
    const blob = new Blob([sql], { type: 'application/sql;charset=utf-8' })
    triggerDownload(blob, `okr-backup-${fileDateStamp()}.sql`)
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

const COLOR = {
    primary: '2563EB',
    primaryDark: '1E3A8A',
    white: 'FFFFFF',
    zebra: 'F1F5F9',
    headerText: 'FFFFFF',
    border: 'E2E8F0',
    muted: '64748B',
} as const

const THIN_BORDER = {
    top: { style: 'thin', color: { rgb: COLOR.border } },
    bottom: { style: 'thin', color: { rgb: COLOR.border } },
    left: { style: 'thin', color: { rgb: COLOR.border } },
    right: { style: 'thin', color: { rgb: COLOR.border } },
} as const

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: COLOR.headerText }, sz: 11 },
    fill: { fgColor: { rgb: COLOR.primary } },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: THIN_BORDER,
} as const

/** Converte um valor de célula para algo exibível no Excel. */
function toCellValue(value: unknown): string | number | boolean {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    if (typeof value === 'number' || typeof value === 'boolean') return value
    return String(value)
}

/** Constrói uma aba estilizada para uma tabela. */
function buildTableSheet(rows: TableData): XLSX.WorkSheet {
    if (rows.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([['(sem registros)']])
        ws['A1'].s = { font: { italic: true, color: { rgb: COLOR.muted } } }
        ws['!cols'] = [{ wch: 20 }]
        return ws
    }

    const columns = unionColumns(rows)
    const aoa: (string | number | boolean)[][] = [
        columns,
        ...rows.map((row) => columns.map((col) => toCellValue(row[col]))),
    ]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const range = XLSX.utils.decode_range(ws['!ref']!)

    // Cabeçalho estilizado
    for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c })
        if (ws[addr]) ws[addr].s = HEADER_STYLE
    }

    // Linhas de dados: zebra + bordas
    for (let r = 1; r <= range.e.r; r++) {
        const zebra = r % 2 === 0
        for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c })
            const cell = ws[addr] ?? (ws[addr] = { t: 's', v: '' })
            cell.s = {
                font: { sz: 10 },
                alignment: { vertical: 'top' },
                border: THIN_BORDER,
                ...(zebra ? { fill: { fgColor: { rgb: COLOR.zebra } } } : {}),
            }
        }
    }

    // Larguras das colunas com base no maior conteúdo (limitado)
    ws['!cols'] = columns.map((col) => {
        let max = col.length
        for (const row of rows) {
            const len = String(toCellValue(row[col])).length
            if (len > max) max = len
        }
        return { wch: Math.min(Math.max(max + 2, 8), 60) }
    })

    // Congela o cabeçalho e habilita filtro
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    ws['!autofilter'] = { ref: ws['!ref']! }

    return ws
}

/** Constrói a aba de índice/capa com resumo do backup. */
function buildIndexSheet(data: BackupData): XLSX.WorkSheet {
    const generatedAt = new Date().toLocaleString('pt-BR')
    const aoa: (string | number)[][] = [
        ['OKR Dashboard — Backup Completo'],
        [`Gerado em: ${generatedAt}`],
        [],
        ['Tabela', 'Registros'],
    ]

    let totalRows = 0
    for (const table of BACKUP_TABLES) {
        const count = data[table]?.length ?? 0
        totalRows += count
        aoa.push([table, count])
    }
    aoa.push(['TOTAL', totalRows])

    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Título
    ws['A1'].s = { font: { bold: true, sz: 16, color: { rgb: COLOR.primaryDark } } }
    ws['A2'].s = { font: { italic: true, sz: 10, color: { rgb: COLOR.muted } } }

    // Cabeçalho da tabela de resumo (linha 4 -> índice 3)
    ws['A4'].s = HEADER_STYLE
    ws['B4'].s = { ...HEADER_STYLE, alignment: { vertical: 'center', horizontal: 'right' } }

    const totalRowIdx = 4 + BACKUP_TABLES.length // linha do TOTAL (base 1)
    for (let r = 5; r <= totalRowIdx; r++) {
        const isTotal = r === totalRowIdx
        const zebra = r % 2 === 0
        const nameCell = ws[`A${r}`]
        const countCell = ws[`B${r}`]
        const base = {
            font: { sz: 10, bold: isTotal },
            border: THIN_BORDER,
            ...(isTotal
                ? { fill: { fgColor: { rgb: COLOR.zebra } } }
                : zebra
                    ? { fill: { fgColor: { rgb: COLOR.zebra } } }
                    : {}),
        }
        if (nameCell) nameCell.s = { ...base, alignment: { vertical: 'center', horizontal: 'left' } }
        if (countCell) countCell.s = { ...base, alignment: { vertical: 'center', horizontal: 'right' } }
    }

    ws['!cols'] = [{ wch: 32 }, { wch: 14 }]
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    ]

    return ws
}

/** Gera e baixa o backup Excel (.xlsx) estilizado. */
export function downloadExcelBackup(data: BackupData): void {
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb, buildIndexSheet(data), 'Índice')

    for (const table of BACKUP_TABLES) {
        // Nome da aba: máx. 31 caracteres (todas as tabelas cabem).
        const sheetName = table.slice(0, 31)
        XLSX.utils.book_append_sheet(wb, buildTableSheet(data[table] ?? []), sheetName)
    }

    XLSX.writeFile(wb, `okr-backup-${fileDateStamp()}.xlsx`)
}
