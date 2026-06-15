"use client"

import { Card, Grid, Heading, Stack } from "@/components/ui"
import { defaultListItems, objectArrayFrom, stringFrom } from "../utils/visual-note-app.utils"
import { ObjectAddButton, ObjectRemoveButton, ObjectTextAreaField, ObjectTextField } from "./display-data-editor-controls"

type ObjectEditorSectionProps = {
    data: Record<string, unknown>
    onAddObjectItem: (field: string, item: Record<string, unknown>) => void
    onRemoveObjectItem: (field: string, index: number) => void
    onUpdateObjectItem: (field: string, index: number, key: string, value: string) => void
}

export function WorkLogsEditorSection({ data, onAddObjectItem, onRemoveObjectItem, onUpdateObjectItem }: ObjectEditorSectionProps) {
    return (
        <Stack gap="md">
            <Heading size="sm">Work logs</Heading>
            {objectArrayFrom(data.workLogs).map((log, index) => (
                <Card key={`${index}-${log.title}`} padding="compact">
                    <Stack gap="md">
                        <Grid columns="two">
                            <ObjectTextField
                                label="Timestamp"
                                field="workLogs"
                                index={index}
                                itemKey="timestamp"
                                value={stringFrom(log.timestamp)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                            <ObjectTextField
                                label="Time worked"
                                field="workLogs"
                                index={index}
                                itemKey="timeWorked"
                                value={stringFrom(log.timeWorked)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                        </Grid>
                        <ObjectTextField label="Title" field="workLogs" index={index} itemKey="title" value={stringFrom(log.title)} onUpdateObjectItem={onUpdateObjectItem} />
                        <ObjectTextAreaField
                            label="Description"
                            field="workLogs"
                            index={index}
                            itemKey="description"
                            value={stringFrom(log.description)}
                            onUpdateObjectItem={onUpdateObjectItem}
                        />
                        <ObjectTextField
                            label="Pull request URL"
                            field="workLogs"
                            index={index}
                            itemKey="pullRequestUrl"
                            value={stringFrom(log.pullRequestUrl)}
                            onUpdateObjectItem={onUpdateObjectItem}
                        />
                        <ObjectRemoveButton field="workLogs" index={index} onRemoveObjectItem={onRemoveObjectItem}>
                            Delete Work Log
                        </ObjectRemoveButton>
                    </Stack>
                </Card>
            ))}
            <ObjectAddButton field="workLogs" item={defaultListItems.workLog} onAddObjectItem={onAddObjectItem}>
                Add Work Log
            </ObjectAddButton>
        </Stack>
    )
}

export function BugsEditorSection({ data, onAddObjectItem, onRemoveObjectItem, onUpdateObjectItem }: ObjectEditorSectionProps) {
    return (
        <Stack gap="md">
            <Heading size="sm">Bugs</Heading>
            {objectArrayFrom(data.bugs).map((bug, index) => (
                <Card key={`${index}-${bug.title}`} padding="compact">
                    <Stack gap="md">
                        <Grid columns="two">
                            <ObjectTextField label="Title" field="bugs" index={index} itemKey="title" value={stringFrom(bug.title)} onUpdateObjectItem={onUpdateObjectItem} />
                            <ObjectTextField
                                label="Severity"
                                field="bugs"
                                index={index}
                                itemKey="severity"
                                value={stringFrom(bug.severity)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                        </Grid>
                        <ObjectTextAreaField
                            label="Description"
                            field="bugs"
                            index={index}
                            itemKey="description"
                            value={stringFrom(bug.description)}
                            onUpdateObjectItem={onUpdateObjectItem}
                        />
                        <ObjectTextField
                            label="GitHub issue or Jira ticket URL"
                            field="bugs"
                            index={index}
                            itemKey="ticketUrl"
                            value={stringFrom(bug.ticketUrl)}
                            onUpdateObjectItem={onUpdateObjectItem}
                        />
                        <ObjectRemoveButton field="bugs" index={index} onRemoveObjectItem={onRemoveObjectItem}>
                            Delete Bug
                        </ObjectRemoveButton>
                    </Stack>
                </Card>
            ))}
            <ObjectAddButton field="bugs" item={defaultListItems.bug} onAddObjectItem={onAddObjectItem}>
                Add Bug
            </ObjectAddButton>
        </Stack>
    )
}

export function ShoppingItemsEditorSection({ data, onAddObjectItem, onRemoveObjectItem, onUpdateObjectItem }: ObjectEditorSectionProps) {
    return (
        <Stack gap="md">
            <Heading size="sm">Shopping items</Heading>
            {objectArrayFrom(data.shoppingItems).map((item, index) => (
                <Card key={`${index}-${item.product}`} padding="compact">
                    <Stack gap="md">
                        <Grid columns="two">
                            <ObjectTextField
                                label="Brand"
                                field="shoppingItems"
                                index={index}
                                itemKey="brand"
                                value={stringFrom(item.brand)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                            <ObjectTextField
                                label="Product"
                                field="shoppingItems"
                                index={index}
                                itemKey="product"
                                value={stringFrom(item.product)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                            <ObjectTextField
                                label="Model or variant"
                                field="shoppingItems"
                                index={index}
                                itemKey="modelVariant"
                                value={stringFrom(item.modelVariant)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                            <ObjectTextField
                                label="Store"
                                field="shoppingItems"
                                index={index}
                                itemKey="store"
                                value={stringFrom(item.store)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                            <ObjectTextField
                                label="Store location"
                                field="shoppingItems"
                                index={index}
                                itemKey="storeLocation"
                                value={stringFrom(item.storeLocation)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                            <ObjectTextField
                                label="Store URL"
                                field="shoppingItems"
                                index={index}
                                itemKey="storeUrl"
                                value={stringFrom(item.storeUrl)}
                                onUpdateObjectItem={onUpdateObjectItem}
                            />
                        </Grid>
                        <ObjectRemoveButton field="shoppingItems" index={index} onRemoveObjectItem={onRemoveObjectItem}>
                            Delete Item
                        </ObjectRemoveButton>
                    </Stack>
                </Card>
            ))}
            <ObjectAddButton field="shoppingItems" item={defaultListItems.shoppingItem} onAddObjectItem={onAddObjectItem}>
                Add Shopping Item
            </ObjectAddButton>
        </Stack>
    )
}
