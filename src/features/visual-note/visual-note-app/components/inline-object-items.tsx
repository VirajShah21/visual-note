import { Plus } from "lucide-react"
import { type ChangeEvent, useCallback } from "react"
import { Button, Grid, Stack, TextField } from "@/components/ui"
import { stringFrom } from "../utils/visual-note-app.utils"

type InlineObjectItemsProps = {
    items: Array<Record<string, unknown>>
    onAdd: () => void
    onChange: (index: number, patch: Record<string, unknown>) => void
    onRemove: (index: number) => void
}

export function InlineObjectItems({ items, onAdd, onChange, onRemove }: InlineObjectItemsProps) {
    return (
        <Stack gap="sm">
            {items.map((item, index) => (
                <InlineObjectItem key={`${index}-${item.label}`} item={item} index={index} onChange={onChange} onRemove={onRemove} />
            ))}
            <Button icon={<Plus size={15} />} variant="ghost" onClick={onAdd}>
                Add packed item
            </Button>
        </Stack>
    )
}

type InlineObjectItemProps = {
    item: Record<string, unknown>
    index: number
    onChange: (index: number, patch: Record<string, unknown>) => void
    onRemove: (index: number) => void
}

function InlineObjectItem({ item, index, onChange, onRemove }: InlineObjectItemProps) {
    const handleLabelChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(index, { label: event.target.value }), [index, onChange])
    const handlePackedChange = useCallback(() => onChange(index, { packed: !Boolean(item.packed) }), [index, item.packed, onChange])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

    return (
        <Grid columns="two" gap="sm">
            <TextField label="Item" value={stringFrom(item.label)} onChange={handleLabelChange} />
            <Button variant={item.packed ? "primary" : "ghost"} onClick={handlePackedChange}>
                {item.packed ? "Packed" : "Open"}
            </Button>
            <Button variant="ghost" onClick={handleRemove}>
                Remove
            </Button>
        </Grid>
    )
}
