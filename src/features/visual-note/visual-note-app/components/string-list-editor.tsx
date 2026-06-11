import { Plus } from "lucide-react"
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
                <Card key={`${index}-${item}`} padding="compact">
                    <Stack gap="md">
                        <TextField label={`${label} ${index + 1}`} value={item} onChange={event => onChange(index, event.target.value)} />
                        <Button variant="ghost" onClick={() => onRemove(index)} fullWidth>
                            Remove {label.toLowerCase()}
                        </Button>
                    </Stack>
                </Card>
            ))}
            <Button icon={<Plus size={15} />} onClick={onAdd} fullWidth>
                Add {label.toLowerCase()}
            </Button>
        </Stack>
    )
}
