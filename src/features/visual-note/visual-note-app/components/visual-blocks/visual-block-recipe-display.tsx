"use client"

import { ListChecks, Plus } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button, Grid, Heading, Stack, Text, TextField } from "@/components/ui"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { arrayFrom, numberFrom, objectArrayFrom, replaceObjectAt, replaceStringAt, stringFrom } from "../../utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"
import { InlineStringList } from "../inline-string-list"

type VisualBlockRecipeDisplayProps = {
    data: VisualBlockData
    onDataChange: (data: VisualBlockData) => void
    header: (icon: ReactNode, title: string) => ReactNode
}

export function VisualBlockRecipeDisplay({ data, onDataChange, header }: VisualBlockRecipeDisplayProps) {
    const [recipePortions, setRecipePortions] = useState(() => numberFrom(data.basePortions, 2))
    const updateField = (field: string, value: unknown) => onDataChange({ ...data, [field]: value })
    const updateStringList = (field: string, index: number, value: string) => updateField(field, replaceStringAt(arrayFrom(data[field]), index, value))
    const addStringListItem = (field: string, value: string) => updateField(field, [...arrayFrom(data[field]), value])
    const removeStringListItem = (field: string, index: number) =>
        updateField(
            field,
            arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index),
        )
    const updateObjectList = (field: string, index: number, patch: Record<string, unknown>) => updateField(field, replaceObjectAt(objectArrayFrom(data[field]), index, patch))
    const addObjectListItem = (field: string, value: Record<string, unknown>) => updateField(field, [...objectArrayFrom(data[field]), value])
    const basePortions = numberFrom(data.basePortions, 1)
    const portionScale = basePortions > 0 ? recipePortions / basePortions : 1
    const ingredients = objectArrayFrom(data.ingredients)

    return (
        <Stack className={styles.visualBlock} gap="md">
            {header(<ListChecks size={13} />, "Recipe")}
            <Stack className={styles.heroPanel} gap="sm">
                <Heading size="md">{stringFrom(data.title, "Recipe")}</Heading>
                <Text>{`Portions: ${recipePortions}`}</Text>
            </Stack>
            <Grid columns="two" gap="sm">
                <TextField label="Title" value={stringFrom(data.title)} onChange={event => updateField("title", event.target.value)} />
                <TextField label="Base portions" type="number" value={String(basePortions)} onChange={event => updateField("basePortions", Number(event.target.value))} />
                <TextField label="Display portions" type="number" value={String(recipePortions)} onChange={event => setRecipePortions(Number(event.target.value) || 1)} />
            </Grid>
            <Stack gap="sm">
                <Heading size="sm">Ingredients</Heading>
                {ingredients.map((ingredient, index) => (
                    <Grid key={`${index}-${ingredient.name}`} columns="three" gap="sm">
                        <TextField label="Name" value={stringFrom(ingredient.name)} onChange={event => updateObjectList("ingredients", index, { name: event.target.value })} />
                        <TextField
                            label="Quantity"
                            type="number"
                            value={String(numberFrom(ingredient.quantity, 0) * portionScale)}
                            onChange={event => updateObjectList("ingredients", index, { quantity: Number(event.target.value) / portionScale })}
                        />
                        <TextField label="Unit" value={stringFrom(ingredient.unit)} onChange={event => updateObjectList("ingredients", index, { unit: event.target.value })} />
                    </Grid>
                ))}
                <Button icon={<Plus size={15} />} variant="ghost" onClick={() => addObjectListItem("ingredients", { name: "Ingredient", quantity: 1, unit: "" })}>
                    Add ingredient
                </Button>
            </Stack>
            <InlineStringList
                title="Cooking steps"
                items={arrayFrom(data.steps)}
                onAdd={() => addStringListItem("steps", "New step")}
                onChange={(index, value) => updateStringList("steps", index, value)}
                onRemove={index => removeStringListItem("steps", index)}
            />
        </Stack>
    )
}
