import { Plus } from "lucide-react"
import { Button, Heading, Stack, TextField } from "@/components/ui"
import styles from "../../visual-note-app.module.css"

type InlineStringListProps = {
    title: string
    items: string[]
    onAdd: () => void
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

export function InlineStringList({ title, items, onAdd, onChange, onRemove }: InlineStringListProps) {
    return (
        <Stack gap="sm">
            <Heading size="sm">{title}</Heading>
            {items.map((item, index) => (
                <Stack key={`${index}-${item}`} direction="horizontal" gap="sm" className={styles.wrapRow}>
                    <TextField label={`${title} ${index + 1}`} value={item} onChange={event => onChange(index, event.target.value)} />
                    <Button variant="ghost" onClick={() => onRemove(index)}>
                        Remove
                    </Button>
                </Stack>
            ))}
            <Button icon={<Plus size={15} />} variant="ghost" onClick={onAdd}>
                Add
            </Button>
        </Stack>
    )
}
