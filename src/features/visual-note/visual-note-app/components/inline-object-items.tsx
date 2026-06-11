import { Plus } from "lucide-react"
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
                <Grid key={`${index}-${item.label}`} columns="two" gap="sm">
                    <TextField label="Item" value={stringFrom(item.label)} onChange={event => onChange(index, { label: event.target.value })} />
                    <Button variant={item.packed ? "primary" : "ghost"} onClick={() => onChange(index, { packed: !Boolean(item.packed) })}>
                        {item.packed ? "Packed" : "Open"}
                    </Button>
                    <Button variant="ghost" onClick={() => onRemove(index)}>
                        Remove
                    </Button>
                </Grid>
            ))}
            <Button icon={<Plus size={15} />} variant="ghost" onClick={onAdd}>
                Add packed item
            </Button>
        </Stack>
    )
}
