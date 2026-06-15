"use client"

import { ListChecks } from "lucide-react"
import { type ChangeEvent, type ReactNode, useCallback, useState } from "react"
import { EditableVisualBlock, Grid, Heading, Stack, Text, TextField } from "@/components/ui"
import type { VisualBlockData } from "@/lib/visual-note/visual-blocks"
import { countLabel, joinedPreviewText } from "../../utils/visual-block-preview"
import { arrayFrom, numberFrom, objectArrayFrom, replaceObjectAt, replaceStringAt, stringFrom } from "../../utils/visual-note-app.utils"
import styles from "../../../visual-note-app.module.css"
import { InlineStringListForField, VisualDataNumberField, VisualDataTextField } from "../visual-block-display-controls"
import { ObjectListAddButton, ObjectListNumberField, ObjectListTextField } from "./visual-block-list-controls"

type VisualBlockRecipeDisplayProps = {
    data: VisualBlockData
    isReadOnly?: boolean
    onDataChange: (data: VisualBlockData) => void
    header: (icon: ReactNode, title: string) => ReactNode
}

export function VisualBlockRecipeDisplay({ data, isReadOnly = false, onDataChange, header }: VisualBlockRecipeDisplayProps) {
    const [recipePortions, setRecipePortions] = useState(() => numberFrom(data.basePortions, 2))
    const updateField = useCallback((field: string, value: unknown) => onDataChange({ ...data, [field]: value }), [data, onDataChange])
    const updateStringList = useCallback(
        (field: string, index: number, value: string) => updateField(field, replaceStringAt(arrayFrom(data[field]), index, value)),
        [data, updateField],
    )
    const addStringListItem = useCallback((field: string, value: string) => updateField(field, [...arrayFrom(data[field]), value]), [data, updateField])
    const removeStringListItem = useCallback(
        (field: string, index: number) =>
            updateField(
                field,
                arrayFrom(data[field]).filter((_, itemIndex) => itemIndex !== index),
            ),
        [data, updateField],
    )
    const updateObjectList = useCallback(
        (field: string, index: number, patch: Record<string, unknown>) => updateField(field, replaceObjectAt(objectArrayFrom(data[field]), index, patch)),
        [data, updateField],
    )
    const addObjectListItem = useCallback((field: string, value: Record<string, unknown>) => updateField(field, [...objectArrayFrom(data[field]), value]), [data, updateField])
    const basePortions = numberFrom(data.basePortions, 1)
    const portionScale = basePortions > 0 ? recipePortions / basePortions : 1
    const ingredients = objectArrayFrom(data.ingredients)
    const steps = arrayFrom(data.steps)
    const preview = (
        <>
            {header(<ListChecks size={13} />, "Recipe")}
            <Stack className={styles.heroPanel} gap="sm">
                <Heading size="md">{stringFrom(data.title, "Recipe")}</Heading>
                <Text>{joinedPreviewText([`Portions: ${recipePortions}`, countLabel(ingredients.length, "ingredient"), countLabel(steps.length, "step")], "Recipe details")}</Text>
            </Stack>
        </>
    )

    return (
        <EditableVisualBlock preview={preview} readOnly={isReadOnly}>
            <Grid columns="two" gap="sm">
                <VisualDataTextField label="Title" field="title" value={stringFrom(data.title)} onUpdateField={updateField} />
                <VisualDataNumberField label="Base portions" field="basePortions" value={String(basePortions)} onUpdateField={updateField} />
                <RecipePortionsField value={String(recipePortions)} onChange={setRecipePortions} />
            </Grid>
            <Stack gap="sm">
                <Heading size="sm">Ingredients</Heading>
                {ingredients.map((ingredient, index) => (
                    <Grid key={`${index}-${ingredient.name}`} columns="three" gap="sm">
                        <ObjectListTextField
                            label="Name"
                            field="ingredients"
                            index={index}
                            itemKey="name"
                            value={stringFrom(ingredient.name)}
                            onUpdateObjectList={updateObjectList}
                        />
                        <IngredientQuantityField
                            index={index}
                            value={String(numberFrom(ingredient.quantity, 0) * portionScale)}
                            portionScale={portionScale}
                            onUpdateObjectList={updateObjectList}
                        />
                        <ObjectListTextField
                            label="Unit"
                            field="ingredients"
                            index={index}
                            itemKey="unit"
                            value={stringFrom(ingredient.unit)}
                            onUpdateObjectList={updateObjectList}
                        />
                    </Grid>
                ))}
                <ObjectListAddButton field="ingredients" value={{ name: "Ingredient", quantity: 1, unit: "" }} onAddObjectListItem={addObjectListItem}>
                    Add ingredient
                </ObjectListAddButton>
            </Stack>
            <InlineStringListForField
                title="Cooking steps"
                items={steps}
                field="steps"
                newItem="New step"
                onAddStringListItem={addStringListItem}
                onUpdateStringList={updateStringList}
                onRemoveStringListItem={removeStringListItem}
            />
        </EditableVisualBlock>
    )
}

function RecipePortionsField({ value, onChange }: { value: string; onChange: (value: number) => void }) {
    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value) || 1), [onChange])

    return <TextField label="Display portions" type="number" value={value} onChange={handleChange} />
}

function IngredientQuantityField({
    index,
    value,
    portionScale,
    onUpdateObjectList,
}: {
    index: number
    value: string
    portionScale: number
    onUpdateObjectList: (field: string, index: number, patch: Record<string, unknown>) => void
}) {
    const handleUpdate = useCallback(
        (field: string, itemIndex: number, patch: Record<string, unknown>) => onUpdateObjectList(field, itemIndex, { quantity: Number(patch.quantity) / portionScale }),
        [onUpdateObjectList, portionScale],
    )

    return <ObjectListNumberField label="Quantity" field="ingredients" index={index} itemKey="quantity" value={value} onUpdateObjectList={handleUpdate} />
}
