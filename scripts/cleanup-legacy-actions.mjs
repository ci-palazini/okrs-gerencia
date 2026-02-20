/**
 * Script one-time para exportar ações legadas (vinculadas a KRs anuais) para Excel
 * e opcionalmente deletá-las do banco.
 *
 * Uso:
 *   node scripts/cleanup-legacy-actions.mjs              # Exporta para Excel
 *   node scripts/cleanup-legacy-actions.mjs --delete      # Exporta + deleta após confirmação
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY no .env (para ignorar RLS)
 * OU credenciais de admin: ADMIN_EMAIL e ADMIN_PASSWORD no .env
 */

import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually
const envPath = resolve(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
    envContent.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => {
            const [key, ...rest] = line.split('=')
            return [key.trim(), rest.join('=').trim()]
        })
)

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos no .env')
    process.exit(1)
}

const shouldDelete = process.argv.includes('--delete')

function askQuestion(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => {
        rl.question(question, answer => { rl.close(); resolve(answer) })
    })
}

async function getClient() {
    // Prefer service role key (bypasses RLS)
    if (serviceRoleKey) {
        console.log('🔑 Usando service_role key\n')
        return createClient(supabaseUrl, serviceRoleKey)
    }

    // Fallback: authenticate as admin
    console.log('🔑 Service role key não encontrada. Autenticando como admin...\n')
    const client = createClient(supabaseUrl, supabaseAnonKey)

    const email = env.ADMIN_EMAIL || await askQuestion('Email do admin: ')
    const password = env.ADMIN_PASSWORD || await askQuestion('Senha do admin: ')

    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
        console.error('❌ Falha na autenticação:', error.message)
        process.exit(1)
    }
    console.log('✅ Autenticado com sucesso\n')
    return client
}

async function main() {
    const supabase = await getClient()

    console.log('🔍 Buscando ações legadas (vinculadas a KRs anuais)...\n')

    const { data: actions, error } = await supabase
        .from('actions')
        .select(`
            id,
            title,
            description,
            status,
            due_date,
            owner_name,
            created_at,
            updated_at,
            key_result_id,
            key_result:key_results(
                id,
                code,
                title,
                scope,
                objective:objectives(
                    title,
                    business_unit:business_units(name)
                )
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Erro ao buscar ações:', error.message)
        process.exit(1)
    }

    // Filter: only actions linked to annual KRs (or null scope)
    const legacyActions = (actions || []).filter(a => {
        const scope = a.key_result?.scope
        return scope === 'annual' || scope === null || scope === undefined
    })

    if (legacyActions.length === 0) {
        console.log('✅ Nenhuma ação legada encontrada. Nada para fazer.')
        process.exit(0)
    }

    console.log(`📋 Encontradas ${legacyActions.length} ações legadas:\n`)

    // Prepare Excel data
    const rows = legacyActions.map(a => ({
        'ID': a.id,
        'Título': a.title,
        'Descrição': a.description || '',
        'Status': a.status,
        'Data Limite': a.due_date || '',
        'Responsável': a.owner_name || '',
        'Criado em': a.created_at,
        'Atualizado em': a.updated_at || '',
        'KR Code': a.key_result?.code || '',
        'KR Título': a.key_result?.title || '',
        'KR Scope': a.key_result?.scope || 'N/A',
        'Objetivo': a.key_result?.objective?.title || '',
        'Empresa': a.key_result?.objective?.business_unit?.name || '',
    }))

    // Print summary
    const byStatus = { pending: 0, in_progress: 0, done: 0 }
    const byUnit = {}
    for (const r of rows) {
        byStatus[r['Status']] = (byStatus[r['Status']] || 0) + 1
        byUnit[r['Empresa'] || 'Sem empresa'] = (byUnit[r['Empresa'] || 'Sem empresa'] || 0) + 1
    }

    console.log('  Por status:')
    for (const [s, n] of Object.entries(byStatus)) {
        if (n > 0) console.log(`    ${s}: ${n}`)
    }
    console.log('\n  Por empresa:')
    for (const [u, n] of Object.entries(byUnit)) {
        console.log(`    ${u}: ${n}`)
    }

    // Generate Excel
    const ws = XLSX.utils.json_to_sheet(rows)

    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map(key => {
        const maxLen = Math.max(
            key.length,
            ...rows.map(r => String(r[key] || '').length)
        )
        return { wch: Math.min(maxLen + 2, 60) }
    })
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ações Legadas')

    const timestamp = new Date().toISOString().slice(0, 10)
    const fileName = `acoes-legadas-export-${timestamp}.xlsx`
    const filePath = resolve(__dirname, '..', fileName)

    XLSX.writeFile(wb, filePath)
    console.log(`\n✅ Excel salvo em: ${filePath}`)

    if (!shouldDelete) {
        console.log('\n💡 Para deletar as ações após verificar o Excel, rode:')
        console.log('   node scripts/cleanup-legacy-actions.mjs --delete')
        process.exit(0)
    }

    // Deletion flow
    const answer = await askQuestion(`\n⚠️  Deseja DELETAR as ${legacyActions.length} ações legadas do banco? (sim/não): `)

    if (answer.toLowerCase() !== 'sim') {
        console.log('❌ Deleção cancelada.')
        process.exit(0)
    }

    const ids = legacyActions.map(a => a.id)
    console.log(`\n🗑️  Deletando ${ids.length} ações...`)

    const { error: deleteError } = await supabase
        .from('actions')
        .delete()
        .in('id', ids)

    if (deleteError) {
        console.error('❌ Erro ao deletar:', deleteError.message)
        process.exit(1)
    }

    console.log(`✅ ${ids.length} ações legadas deletadas com sucesso.`)
}

main().catch(err => {
    console.error('❌ Erro inesperado:', err)
    process.exit(1)
})
