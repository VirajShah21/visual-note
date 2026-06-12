"use client"

import type { ChangeEvent } from "react"
import { cx } from "./class-name"
import styles from "./chart-data-sheet.module.css"

export type ChartDataLayout = "columns" | "rows"

type ChartDataSheetProps = {
    sheet: string[][]
    onSheetChange: (sheet: string[][]) => void
}

export function ChartDataSheet({ sheet, onSheetChange }: ChartDataSheetProps) {
    const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
        onSheetChange(sheet.map((row, nextRowIndex) => (nextRowIndex === rowIndex ? row.map((cell, nextColumnIndex) => (nextColumnIndex === columnIndex ? value : cell)) : row)))
    }
    const handleCellChange = (rowIndex: number, columnIndex: number) => (event: ChangeEvent<HTMLInputElement>) => updateCell(rowIndex, columnIndex, event.target.value)
    const cellInput = (rowIndex: number, columnIndex: number, value: string, className: string) => (
        <input className={className} value={value} aria-label={`Chart data cell ${rowIndex + 1}, ${columnIndex + 1}`} onChange={handleCellChange(rowIndex, columnIndex)} />
    )

    return (
        <div className={styles.sheetFrame}>
            <table className={styles.sheet}>
                <thead>
                    <tr>
                        {sheet[0]?.map((cell, columnIndex) => (
                            <th key={`header-${columnIndex}`} className={cx(styles.headerCell, columnIndex === 0 && styles.cornerCell)}>
                                {cellInput(0, columnIndex, cell, cx(styles.input, styles.headerInput))}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sheet.slice(1).map((row, rowOffset) => {
                        const rowIndex = rowOffset + 1

                        return (
                            <tr key={rowIndex}>
                                {row.map((cell, columnIndex) => (
                                    <td key={`${rowIndex}-${columnIndex}`} className={cx(styles.cell, columnIndex === 0 && styles.rowHeader)}>
                                        {columnIndex === 0
                                            ? cellInput(rowIndex, columnIndex, cell, cx(styles.input, styles.headerInput))
                                            : cellInput(rowIndex, columnIndex, cell, styles.input)}
                                    </td>
                                ))}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
