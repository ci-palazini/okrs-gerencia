import { Layers } from 'lucide-react'
import { PillarsTab } from '../settings/PillarsTab'

export function PillarsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-primary)]/15">
                    <Layers className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Pilares</h1>
                    <p className="text-[var(--color-text-secondary)] mt-0.5">
                        Gerencie os pilares estratégicos da organização
                    </p>
                </div>
            </div>
            <PillarsTab />
        </div>
    )
}
