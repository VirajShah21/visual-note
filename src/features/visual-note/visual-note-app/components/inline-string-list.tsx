import { Plus } from "lucide-react"
import { type ChangeEvent, useCallback } from "react"
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
                <InlineStringListItem key={`${index}-${item}`} title={title} item={item} index={index} onChange={onChange} onRemove={onRemove} />
            ))}
            <Button icon={<Plus size={15} />} variant="ghost" onClick={onAdd}>
                Add
            </Button>
        </Stack>
    )
}

type InlineStringListItemProps = {
    title: string
    item: string
    index: number
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

function InlineStringListItem({ title, item, index, onChange, onRemove }: InlineStringListItemProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(index, event.target.value), [index, onChange])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

    return (
        <Stack direction="horizontal" gap="sm" className={styles.wrapRow}>
            <TextField label={`${title} ${index + 1}`} value={item} onChange={handleChange} />
            <Button variant="ghost" onClick={handleRemove}>
                Remove
            </Button>
        </Stack>
    )
}
