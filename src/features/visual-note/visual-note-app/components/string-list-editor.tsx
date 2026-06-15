import { Plus } from "lucide-react"
import { type ChangeEvent, useCallback } from "react"
import { Button, Card, Heading, Stack, TextField } from "@/components/ui"

type StringListEditorProps = {
    title: string
    items: string[]
    label: string
    onAdd: () => void
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

export function StringListEditor({ title, items, label, onAdd, onChange, onRemove }: StringListEditorProps) {
    return (
        <Stack gap="md">
            <Heading size="sm">{title}</Heading>
            {items.map((item, index) => (
                <StringListEditorItem key={`${index}-${item}`} item={item} index={index} label={label} onChange={onChange} onRemove={onRemove} />
            ))}
            <Button icon={<Plus size={15} />} onClick={onAdd} fullWidth>
                Add {label.toLowerCase()}
            </Button>
        </Stack>
    )
}

type StringListEditorItemProps = {
    item: string
    index: number
    label: string
    onChange: (index: number, value: string) => void
    onRemove: (index: number) => void
}

function StringListEditorItem({ item, index, label, onChange, onRemove }: StringListEditorItemProps) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(index, event.target.value), [index, onChange])
    const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

    return (
        <Card padding="compact">
            <Stack gap="md">
                <TextField label={`${label} ${index + 1}`} value={item} onChange={handleChange} />
                <Button variant="ghost" onClick={handleRemove} fullWidth>
                    Remove {label.toLowerCase()}
                </Button>
            </Stack>
        </Card>
    )
}
